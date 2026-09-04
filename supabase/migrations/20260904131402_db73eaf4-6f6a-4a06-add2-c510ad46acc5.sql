REVOKE ALL ON FUNCTION public.seed_platform_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_platform_admin(text) FROM anon;
REVOKE ALL ON FUNCTION public.seed_platform_admin(text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.seed_platform_admin(text) TO service_role;