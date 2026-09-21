-- Staff invitations: explicit accept step for existing platform users, and
-- direct registration (with a hotel-supplied password) for people who don't
-- have an account yet.
--
-- invite_status values:
--   'invited'  -> invitation/registration sent but not yet honoured
--                 (user_id IS NULL = awaiting sign-up, legacy path)
--                 (user_id set + is_active false = awaiting acceptance)
--   'accepted' -> person is an active member of the hotel
--   'declined' -> not used by the current code, reserved for future UI

ALTER TABLE public.hotel_members
  ADD COLUMN IF NOT EXISTS invite_status text;

UPDATE public.hotel_members
SET invite_status = CASE
  WHEN user_id IS NOT NULL AND is_active THEN 'accepted'
  ELSE 'invited'
END
WHERE invite_status IS NULL;

ALTER TABLE public.hotel_members
  ALTER COLUMN invite_status SET NOT NULL;

ALTER TABLE public.hotel_members
  ALTER COLUMN invite_status SET DEFAULT 'invited';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hotel_members_invite_status_check'
  ) THEN
    ALTER TABLE public.hotel_members
      ADD CONSTRAINT hotel_members_invite_status_check
      CHECK (invite_status IN ('invited', 'accepted', 'declined'));
  END IF;
END $$;

-- When a brand-new person signs up with an email that was already invited,
-- claim the pending row and mark it accepted so they get access immediately.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
          NEW.email,
          NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;

  UPDATE public.hotel_members
  SET user_id = NEW.id, is_active = true, invite_status = 'accepted'
  WHERE user_id IS NULL AND lower(invited_email) = lower(NEW.email);
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hotel_staff') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;