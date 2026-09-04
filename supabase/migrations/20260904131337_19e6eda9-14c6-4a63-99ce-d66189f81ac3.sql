REVOKE EXECUTE ON FUNCTION public.seed_platform_admin(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_platform_admin(text) FROM authenticated;

-- service_role remains able to execute via backend/admin tooling
GRANT EXECUTE ON FUNCTION public.seed_platform_admin(text) TO service_role;