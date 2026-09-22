-- The "Hotel people view published requests" policy called
-- user_is_hotel_person(uuid), which 20260904135244 deliberately revoked from
-- authenticated: the uuid-taking helpers are trigger-only, because letting a
-- signed-in person pass any uuid lets them probe other accounts. The no-argument
-- helpers that read auth.uid() are the ones granted to authenticated.
--
-- Because Postgres ORs every permissive SELECT policy on a table, that call was
-- evaluated on *every* authenticated read of accommodation_requests — so a
-- school opening its own draft, and a hostel opening /allocations, both failed
-- with "permission denied for function user_is_hotel_person".
--
-- Add the missing no-argument helper, in the shape of is_platform_team(), and
-- point the policy at it.

CREATE OR REPLACE FUNCTION public.is_hotel_person() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hotel_members WHERE user_id = auth.uid() AND is_active)
  );
$$;

REVOKE ALL ON FUNCTION public.is_hotel_person() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_hotel_person() TO authenticated, service_role;

DROP POLICY IF EXISTS "Hotel people view published requests" ON public.accommodation_requests;
CREATE POLICY "Hotel people view published requests" ON public.accommodation_requests
  FOR SELECT TO authenticated
  USING (
    status IN ('published', 'allocating', 'confirmed')
    AND public.is_hotel_person()
  );
