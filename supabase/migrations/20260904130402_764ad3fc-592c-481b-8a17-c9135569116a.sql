CREATE OR REPLACE FUNCTION public.has_hotel_access(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR public.owns_hotel(_hotel_id)
    OR EXISTS (SELECT 1 FROM public.hotel_members m
               WHERE m.hotel_id = _hotel_id AND m.user_id = auth.uid() AND m.is_active)
  );
$function$;

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

  UPDATE public.hotel_members SET user_id = NEW.id
  WHERE user_id IS NULL AND lower(invited_email) = lower(NEW.email);
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hotel_staff') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;