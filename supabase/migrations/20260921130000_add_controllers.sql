-- Controller module: schools that hostels are affiliated with.
-- Hybrid v1: platform admins create controller records and link school-staff
-- user accounts; those staff post accommodation requests and assign students;
-- hostel owners respond with offers and check students in as occupancies.

-- 1. New app role for school staff accounts
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'controller';

-- 2. Access helper (mirrors has_hotel_access)
CREATE OR REPLACE FUNCTION public.has_controller_access(_controller_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.controller_members cm
               WHERE cm.controller_id = _controller_id
                 AND cm.user_id = auth.uid()
                 AND cm.is_active)
  );
$$;

-- 3. controllers (the school itself)
CREATE TABLE public.controllers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'university'
    CHECK (kind IN ('university', 'college', 'training', 'other')),
  email text,
  phone text,
  website text,
  address text DEFAULT ''::text NOT NULL,
  city text DEFAULT ''::text NOT NULL,
  country text DEFAULT 'Ghana'::text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX controllers_status_idx ON public.controllers(status);

ALTER TABLE public.controllers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.controllers TO service_role;

CREATE POLICY "Platform team manages controllers" ON public.controllers
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members view their school" ON public.controllers
  FOR SELECT TO authenticated
  USING (public.has_controller_access(id));

CREATE TRIGGER controllers_updated BEFORE UPDATE ON public.controllers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. controller_members (school staff accounts)
CREATE TABLE public.controller_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id uuid NOT NULL REFERENCES public.controllers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'admissions', 'finance')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT controller_members_controller_user_key UNIQUE (controller_id, user_id)
);

CREATE INDEX controller_members_user_idx ON public.controller_members(user_id);

ALTER TABLE public.controller_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.controller_members TO service_role;

CREATE POLICY "Platform team manages controller members" ON public.controller_members
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members view their team" ON public.controller_members
  FOR SELECT TO authenticated
  USING (public.has_controller_access(controller_id));

CREATE TRIGGER controller_members_updated BEFORE UPDATE ON public.controller_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- 5. hotel_controller_affiliations (which hostels a school works with)
CREATE TABLE public.hotel_controller_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id uuid NOT NULL REFERENCES public.controllers(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT hotel_controller_affiliations_pair_key UNIQUE (controller_id, hotel_id)
);

CREATE INDEX hotel_controller_affiliations_hotel_idx ON public.hotel_controller_affiliations(hotel_id);
CREATE INDEX hotel_controller_affiliations_controller_idx ON public.hotel_controller_affiliations(controller_id);

ALTER TABLE public.hotel_controller_affiliations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.hotel_controller_affiliations TO service_role;

CREATE POLICY "Platform team manages affiliations" ON public.hotel_controller_affiliations
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members manage affiliations" ON public.hotel_controller_affiliations
  FOR ALL TO authenticated
  USING (public.has_controller_access(controller_id))
  WITH CHECK (public.has_controller_access(controller_id));
CREATE POLICY "Hotel team view affiliations" ON public.hotel_controller_affiliations
  FOR SELECT TO authenticated
  USING (public.has_hotel_access(hotel_id));

CREATE TRIGGER hotel_controller_affiliations_updated BEFORE UPDATE ON public.hotel_controller_affiliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. accommodation_requests (a school's demand post)
CREATE TABLE public.accommodation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id uuid NOT NULL REFERENCES public.controllers(id) ON DELETE CASCADE,
  title text NOT NULL,
  semester text NOT NULL DEFAULT ''::text,
  period_start date,
  period_end date,
  students_count integer NOT NULL DEFAULT 0 CHECK (students_count >= 0),
  budget_per_student numeric(12,2),
  gender_mix text DEFAULT ''::text NOT NULL,
  preferred_city text DEFAULT ''::text NOT NULL,
  notes text DEFAULT ''::text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'allocating', 'confirmed', 'completed', 'cancelled')),
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT accommodation_requests_period_check
    CHECK (period_end IS NULL OR period_start IS NULL OR period_end > period_start)
);

CREATE INDEX accommodation_requests_controller_idx ON public.accommodation_requests(controller_id);
CREATE INDEX accommodation_requests_status_idx ON public.accommodation_requests(status);

ALTER TABLE public.accommodation_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.accommodation_requests TO service_role;
GRANT SELECT ON public.accommodation_requests TO authenticated;

CREATE POLICY "Platform team manages accommodation requests" ON public.accommodation_requests
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members manage their requests" ON public.accommodation_requests
  FOR ALL TO authenticated
  USING (public.has_controller_access(controller_id))
  WITH CHECK (public.has_controller_access(controller_id));

CREATE TRIGGER accommodation_requests_updated BEFORE UPDATE ON public.accommodation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. allocation_offers (a hostel's response to a request)
CREATE TABLE public.allocation_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.accommodation_requests(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  beds_available integer NOT NULL DEFAULT 0 CHECK (beds_available >= 0),
  price_per_student numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_per_student >= 0),
  notes text DEFAULT ''::text NOT NULL,
  status text NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered', 'accepted', 'declined', 'withdrawn')),
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT allocation_offers_request_hotel_key UNIQUE (request_id, hotel_id)
);

CREATE INDEX allocation_offers_request_idx ON public.allocation_offers(request_id);
CREATE INDEX allocation_offers_hotel_idx ON public.allocation_offers(hotel_id);

ALTER TABLE public.allocation_offers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.allocation_offers TO service_role;

CREATE POLICY "Platform team manages offers" ON public.allocation_offers
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Hotel team manages their offers" ON public.allocation_offers
  FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));
CREATE POLICY "Controller members view offers" ON public.allocation_offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accommodation_requests ar
      WHERE ar.id = allocation_offers.request_id
        AND public.has_controller_access(ar.controller_id)
    )
  );

CREATE TRIGGER allocation_offers_updated BEFORE UPDATE ON public.allocation_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- 8. students (a school's student registry)
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id uuid NOT NULL REFERENCES public.controllers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  student_ref text DEFAULT ''::text NOT NULL,
  program text DEFAULT ''::text NOT NULL,
  level_year text DEFAULT ''::text NOT NULL,
  gender text DEFAULT ''::text NOT NULL,
  phone text,
  email text,
  guardian_name text DEFAULT ''::text NOT NULL,
  guardian_phone text DEFAULT ''::text NOT NULL,
  notes text DEFAULT ''::text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX students_controller_idx ON public.students(controller_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.students TO service_role;

CREATE POLICY "Platform team manages students" ON public.students
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members manage their students" ON public.students
  FOR ALL TO authenticated
  USING (public.has_controller_access(controller_id))
  WITH CHECK (public.has_controller_access(controller_id));

CREATE TRIGGER students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. student_allocations (student -> hostel/room/year, linked to occupancy on check-in)
CREATE TABLE public.student_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.accommodation_requests(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.allocation_offers(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  controller_id uuid NOT NULL REFERENCES public.controllers(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  bed_number text,
  price numeric(12,2),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  occupancy_id uuid REFERENCES public.occupancies(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT student_allocations_student_request_key UNIQUE (student_id, request_id)
);

CREATE INDEX student_allocations_controller_idx ON public.student_allocations(controller_id);
CREATE INDEX student_allocations_hotel_idx ON public.student_allocations(hotel_id);
CREATE INDEX student_allocations_status_idx ON public.student_allocations(status);

ALTER TABLE public.student_allocations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.student_allocations TO service_role;

CREATE POLICY "Platform team manages allocations" ON public.student_allocations
  FOR ALL TO authenticated
  USING (public.is_platform_team())
  WITH CHECK (public.is_platform_team());
CREATE POLICY "Controller members manage their allocations" ON public.student_allocations
  FOR ALL TO authenticated
  USING (public.has_controller_access(controller_id))
  WITH CHECK (public.has_controller_access(controller_id));
CREATE POLICY "Hotel team manage their allocations" ON public.student_allocations
  FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE TRIGGER student_allocations_updated BEFORE UPDATE ON public.student_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();