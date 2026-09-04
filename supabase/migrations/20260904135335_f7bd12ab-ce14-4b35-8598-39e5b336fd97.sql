-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','quarterly','annually')),
  price numeric NOT NULL DEFAULT 0,
  registration_fee numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  max_rooms integer,
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (is_active OR public.is_platform_team());
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- HOTEL SUBSCRIPTIONS
CREATE TABLE public.hotel_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL UNIQUE REFERENCES public.hotels(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','cancelled')),
  registration_fee_paid boolean NOT NULL DEFAULT false,
  commission_percent_override numeric,
  started_at date NOT NULL DEFAULT current_date,
  current_period_end date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hotel_subscriptions TO authenticated;
GRANT ALL ON public.hotel_subscriptions TO service_role;
ALTER TABLE public.hotel_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel team and platform team can view subscriptions" ON public.hotel_subscriptions
  FOR SELECT TO authenticated USING (public.is_platform_team() OR public.has_hotel_access(hotel_id));
CREATE TRIGGER hotel_subscriptions_updated BEFORE UPDATE ON public.hotel_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('registration','subscription','commission','advertising','other')),
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','void')),
  period_start date,
  period_end date,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel team and platform team can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_platform_team() OR public.has_hotel_access(hotel_id));
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX invoices_hotel_idx ON public.invoices (hotel_id, created_at DESC);

-- AD REQUESTS
CREATE TABLE public.ad_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  placement text NOT NULL CHECK (placement IN ('home_featured','search_top','banner')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  message text NOT NULL DEFAULT '',
  quoted_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  is_paid boolean NOT NULL DEFAULT false,
  decision_reason text NOT NULL DEFAULT '',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_requests TO authenticated;
GRANT ALL ON public.ad_requests TO service_role;
ALTER TABLE public.ad_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel team and platform team can view ad requests" ON public.ad_requests
  FOR SELECT TO authenticated USING (public.is_platform_team() OR public.has_hotel_access(hotel_id));
CREATE POLICY "Hotel team can request ads" ON public.ad_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_hotel_access(hotel_id) AND requested_by = auth.uid());
CREATE TRIGGER ad_requests_updated BEFORE UPDATE ON public.ad_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DATA REQUESTS
CREATE TABLE public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('export','delete')),
  scope text NOT NULL DEFAULT 'all',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','declined')),
  response_note text NOT NULL DEFAULT '',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel team and platform team can view data requests" ON public.data_requests
  FOR SELECT TO authenticated USING (public.is_platform_team() OR public.has_hotel_access(hotel_id));
CREATE POLICY "Hotel team can raise data requests" ON public.data_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_hotel_access(hotel_id) AND requested_by = auth.uid());
CREATE TRIGGER data_requests_updated BEFORE UPDATE ON public.data_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COMMISSION ON BOOKINGS
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS commission_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0;

-- PLATFORM DEFAULTS
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS registration_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_price_home_featured numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_price_search_top numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_price_banner numeric NOT NULL DEFAULT 0;

-- Commission rate that applies to a hotel right now
CREATE OR REPLACE FUNCTION public.hotel_commission_percent(_hotel_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.commission_percent_override FROM public.hotel_subscriptions s WHERE s.hotel_id = _hotel_id),
    (SELECT p.commission_percent FROM public.hotel_subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.hotel_id = _hotel_id),
    (SELECT ps.commission_percent FROM public.platform_settings ps WHERE ps.id),
    0
  );
$$;
REVOKE ALL ON FUNCTION public.hotel_commission_percent(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.hotel_commission_percent(uuid) TO authenticated, service_role;