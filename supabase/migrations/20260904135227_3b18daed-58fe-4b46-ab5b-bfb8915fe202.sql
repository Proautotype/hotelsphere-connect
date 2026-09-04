-- New platform-team level and new hotel job title
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_support';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'hotel_admin';

-- Is the current user part of the platform team (admin or support)?
CREATE OR REPLACE FUNCTION public.is_platform_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('platform_admin', 'platform_support')
  );
$$;

-- Does this user hold any platform-team role?
CREATE OR REPLACE FUNCTION public.user_is_platform_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('platform_admin', 'platform_support')
  );
$$;

-- Does this user belong to any hotel (as owner or active team member)?
CREATE OR REPLACE FUNCTION public.user_is_hotel_person(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.hotel_members WHERE user_id = _user_id);
$$;

-- Block platform roles for accounts tied to a hotel
CREATE OR REPLACE FUNCTION public.enforce_role_separation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text IN ('platform_admin', 'platform_support')
     AND public.user_is_hotel_person(NEW.user_id) THEN
    RAISE EXCEPTION 'This account belongs to a hotel business and cannot join the platform team';
  END IF;
  IF NEW.role::text IN ('hotel_owner', 'hotel_staff')
     AND public.user_is_platform_team(NEW.user_id) THEN
    RAISE EXCEPTION 'Platform team accounts cannot own or work at a hotel';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_roles_role_separation ON public.user_roles;
CREATE TRIGGER user_roles_role_separation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_separation();

-- Block hotel ownership / membership for platform-team accounts
CREATE OR REPLACE FUNCTION public.enforce_hotel_not_platform_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND public.user_is_platform_team(NEW.owner_id) THEN
    RAISE EXCEPTION 'Platform team accounts cannot own a hotel';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS hotels_not_platform_team ON public.hotels;
CREATE TRIGGER hotels_not_platform_team
BEFORE INSERT OR UPDATE OF owner_id ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.enforce_hotel_not_platform_team();

CREATE OR REPLACE FUNCTION public.enforce_member_not_platform_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.user_is_platform_team(NEW.user_id) THEN
    RAISE EXCEPTION 'Platform team accounts cannot be added to a hotel team';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS hotel_members_not_platform_team ON public.hotel_members;
CREATE TRIGGER hotel_members_not_platform_team
BEFORE INSERT OR UPDATE OF user_id ON public.hotel_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_member_not_platform_team();