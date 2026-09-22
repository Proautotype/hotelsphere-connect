-- has_controller_access() was created without an explicit grant, so it kept
-- Postgres's default of EXECUTE TO PUBLIC — which includes anon. It returns
-- false for a signed-out caller, so nothing leaks, but every other access
-- helper in this schema is revoked from PUBLIC first and then granted, and
-- leaving the one exception invites the next policy to copy it.
REVOKE ALL ON FUNCTION public.has_controller_access(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_controller_access(uuid) TO authenticated, service_role;
