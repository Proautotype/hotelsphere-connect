REVOKE ALL ON FUNCTION public.user_is_platform_team(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.user_is_hotel_person(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.enforce_role_separation() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.enforce_hotel_not_platform_team() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.enforce_member_not_platform_team() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_platform_team() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_team() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_platform_team(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_hotel_person(uuid) TO service_role;