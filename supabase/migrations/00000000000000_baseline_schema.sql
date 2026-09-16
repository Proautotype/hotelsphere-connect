-- Baseline: complete current database structure (public schema) for Custard Hotels.
-- Generated from the live database. Safe to run on a fresh project before the
-- timestamped migrations that follow.

-- Name: app_role; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.app_role AS ENUM (
    'platform_admin',
    'hotel_owner',
    'hotel_staff',
    'customer',
    'platform_support'
);



-- Name: booking_source; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.booking_source AS ENUM (
    'staff',
    'hotel_website',
    'discovery',
    'external'
);



-- Name: booking_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'no_show'
);



-- Name: cash_session_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.cash_session_status AS ENUM (
    'open',
    'closed'
);



-- Name: expense_category; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.expense_category AS ENUM (
    'utilities',
    'supplies',
    'salaries',
    'maintenance',
    'food_drink',
    'transport',
    'marketing',
    'rent',
    'taxes_fees',
    'other'
);



-- Name: hotel_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.hotel_status AS ENUM (
    'pending',
    'active',
    'suspended',
    'rejected',
    'archived'
);



-- Name: payment_method; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.payment_method AS ENUM (
    'mobile_money',
    'cash',
    'bank_transfer',
    'card'
);



-- Name: payment_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'processing',
    'successful',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded'
);



-- Name: room_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.room_status AS ENUM (
    'available',
    'reserved',
    'occupied',
    'cleaning',
    'dirty',
    'inspected',
    'maintenance',
    'out_of_service'
);



-- Name: staff_role; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.staff_role AS ENUM (
    'manager',
    'receptionist',
    'cashier',
    'accountant',
    'housekeeping',
    'restaurant',
    'other',
    'hotel_admin'
);



-- Name: booking_reference_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.booking_reference_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



-- Name: payment_reference_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.payment_reference_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



-- Name: receipt_number_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.receipt_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



-- Name: ad_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ad_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    placement text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    quoted_price numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    decision_reason text DEFAULT ''::text NOT NULL,
    requested_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_requests_placement_check CHECK ((placement = ANY (ARRAY['home_featured'::text, 'search_top'::text, 'banner'::text]))),
    CONSTRAINT ad_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])))
);



-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid,
    user_id uuid,
    actor_name text DEFAULT ''::text NOT NULL,
    action text NOT NULL,
    resource text NOT NULL,
    resource_id text,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: bookings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    reference text DEFAULT ((('BK-'::text || to_char(now(), 'YYMM'::text)) || '-'::text) || nextval('public.booking_reference_seq'::regclass)) NOT NULL,
    guest_id uuid NOT NULL,
    room_id uuid,
    room_type_id uuid,
    check_in date NOT NULL,
    check_out date NOT NULL,
    nights integer GENERATED ALWAYS AS (GREATEST((check_out - check_in), 1)) STORED,
    guests_count integer DEFAULT 1 NOT NULL,
    room_rate numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    service_charge numeric(12,2) DEFAULT 0 NOT NULL,
    services_total numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    status public.booking_status DEFAULT 'pending'::public.booking_status NOT NULL,
    source public.booking_source DEFAULT 'staff'::public.booking_source NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    customer_user_id uuid,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    commission_percent numeric DEFAULT 0 NOT NULL,
    commission_amount numeric DEFAULT 0 NOT NULL,
    refunded_amount numeric DEFAULT 0 NOT NULL,
    withheld_amount numeric DEFAULT 0 NOT NULL,
    early_checkout boolean DEFAULT false NOT NULL,
    CONSTRAINT bookings_check CHECK ((check_out > check_in))
);



-- Name: cash_sessions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    user_id uuid,
    cashier_name text DEFAULT ''::text NOT NULL,
    opening_balance numeric(12,2) DEFAULT 0 NOT NULL,
    expected_cash numeric(12,2),
    actual_cash numeric(12,2),
    difference numeric(12,2),
    status public.cash_session_status DEFAULT 'open'::public.cash_session_status NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);



-- Name: data_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.data_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    kind text NOT NULL,
    scope text DEFAULT 'all'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    response_note text DEFAULT ''::text NOT NULL,
    requested_by uuid,
    decided_by uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT data_requests_kind_check CHECK ((kind = ANY (ARRAY['export'::text, 'delete'::text]))),
    CONSTRAINT data_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'completed'::text, 'declined'::text])))
);



-- Name: expenses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    spent_on date DEFAULT CURRENT_DATE NOT NULL,
    category public.expense_category DEFAULT 'other'::public.expense_category NOT NULL,
    vendor text DEFAULT ''::text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    method public.payment_method DEFAULT 'cash'::public.payment_method NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    cash_session_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_amount_check CHECK ((amount >= (0)::numeric))
);



-- Name: folio_items; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.folio_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: guests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    country text DEFAULT 'Ghana'::text NOT NULL,
    id_type text,
    id_number text,
    emergency_contact text,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: hotel_members; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.hotel_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    user_id uuid,
    invited_email text,
    full_name text DEFAULT ''::text NOT NULL,
    staff_role public.staff_role DEFAULT 'receptionist'::public.staff_role NOT NULL,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: hotel_payment_methods; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.hotel_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    provider text DEFAULT 'manual'::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);



-- Name: hotel_subscriptions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.hotel_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'trial'::text NOT NULL,
    registration_fee_paid boolean DEFAULT false NOT NULL,
    commission_percent_override numeric,
    started_at date DEFAULT CURRENT_DATE NOT NULL,
    current_period_end date,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hotel_subscriptions_status_check CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'cancelled'::text])))
);



-- Name: hotels; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.hotels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    hotel_type text DEFAULT 'hotel'::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    region text DEFAULT ''::text NOT NULL,
    country text DEFAULT 'Ghana'::text NOT NULL,
    phone text,
    email text,
    website text,
    logo_url text,
    cover_url text,
    latitude numeric(10,6),
    longitude numeric(10,6),
    room_count integer DEFAULT 0 NOT NULL,
    amenities text[] DEFAULT '{}'::text[] NOT NULL,
    currency text DEFAULT 'GHS'::text NOT NULL,
    timezone text DEFAULT 'Africa/Accra'::text NOT NULL,
    check_in_time time without time zone DEFAULT '14:00:00'::time without time zone NOT NULL,
    check_out_time time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    tax_percent numeric(6,2) DEFAULT 12.5 NOT NULL,
    service_charge_percent numeric(6,2) DEFAULT 5 NOT NULL,
    cancellation_policy text DEFAULT ''::text NOT NULL,
    status public.hotel_status DEFAULT 'pending'::public.hotel_status NOT NULL,
    rejection_reason text,
    is_public_listed boolean DEFAULT false NOT NULL,
    accept_online_bookings boolean DEFAULT false NOT NULL,
    show_prices boolean DEFAULT true NOT NULL,
    show_availability boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    rating numeric(3,2) DEFAULT 0 NOT NULL,
    onboarding_step integer DEFAULT 0 NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    early_checkout_withhold_percent numeric DEFAULT 0 NOT NULL,
    early_checkout_withhold_flat numeric DEFAULT 0 NOT NULL,
    photos text[] DEFAULT '{}'::text[] NOT NULL,
    videos text[] DEFAULT '{}'::text[] NOT NULL,
    tour_video_path text DEFAULT ''::text NOT NULL
);



-- Name: invoices; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    number text NOT NULL,
    kind text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'GHS'::text NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    period_start date,
    period_end date,
    due_date date,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_kind_check CHECK ((kind = ANY (ARRAY['registration'::text, 'subscription'::text, 'commission'::text, 'advertising'::text, 'other'::text]))),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'void'::text])))
);



-- Name: notifications; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    hotel_id uuid,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: payments; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    booking_id uuid,
    guest_id uuid,
    cash_session_id uuid,
    reference text DEFAULT ((('PAY-'::text || to_char(now(), 'YYMM'::text)) || '-'::text) || nextval('public.payment_reference_seq'::regclass)) NOT NULL,
    receipt_number text DEFAULT ((('RCP-'::text || to_char(now(), 'YYMM'::text)) || '-'::text) || nextval('public.receipt_number_seq'::regclass)) NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'GHS'::text NOT NULL,
    method public.payment_method NOT NULL,
    provider text DEFAULT 'manual'::text NOT NULL,
    provider_reference text,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    reason text DEFAULT 'booking_payment'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_by uuid,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'charge'::text NOT NULL,
    CONSTRAINT payments_kind_check CHECK ((kind = ANY (ARRAY['charge'::text, 'refund'::text])))
);



-- Name: plans; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    billing_period text DEFAULT 'monthly'::text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    registration_fee numeric DEFAULT 0 NOT NULL,
    commission_percent numeric DEFAULT 0 NOT NULL,
    max_rooms integer,
    features text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_billing_period_check CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annually'::text])))
);



-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.platform_settings (
    id boolean DEFAULT true NOT NULL,
    auto_approve_hotels boolean DEFAULT false NOT NULL,
    platform_name text DEFAULT 'Custard Hotels'::text NOT NULL,
    support_email text DEFAULT 'support@custardhotels.com'::text NOT NULL,
    commission_percent numeric(6,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    registration_fee numeric DEFAULT 0 NOT NULL,
    ad_price_home_featured numeric DEFAULT 0 NOT NULL,
    ad_price_search_top numeric DEFAULT 0 NOT NULL,
    ad_price_banner numeric DEFAULT 0 NOT NULL,
    CONSTRAINT platform_settings_id_check CHECK (id)
);



-- Name: profiles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    email text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: room_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.room_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    max_guests integer DEFAULT 2 NOT NULL,
    bed_count integer DEFAULT 1 NOT NULL,
    bed_type text DEFAULT 'Double'::text NOT NULL,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    amenities text[] DEFAULT '{}'::text[] NOT NULL,
    images text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: rooms; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    room_type_id uuid,
    room_number text NOT NULL,
    floor text DEFAULT '1'::text NOT NULL,
    status public.room_status DEFAULT 'available'::public.room_status NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: services; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: user_roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



-- Name: ad_requests ad_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ad_requests
    ADD CONSTRAINT ad_requests_pkey PRIMARY KEY (id);



-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);



-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);



-- Name: bookings bookings_reference_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_reference_key UNIQUE (reference);



-- Name: cash_sessions cash_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);



-- Name: data_requests data_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.data_requests
    ADD CONSTRAINT data_requests_pkey PRIMARY KEY (id);



-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);



-- Name: folio_items folio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.folio_items
    ADD CONSTRAINT folio_items_pkey PRIMARY KEY (id);



-- Name: guests guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_pkey PRIMARY KEY (id);



-- Name: hotel_members hotel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_members
    ADD CONSTRAINT hotel_members_pkey PRIMARY KEY (id);



-- Name: hotel_payment_methods hotel_payment_methods_hotel_id_method_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_payment_methods
    ADD CONSTRAINT hotel_payment_methods_hotel_id_method_key UNIQUE (hotel_id, method);



-- Name: hotel_payment_methods hotel_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_payment_methods
    ADD CONSTRAINT hotel_payment_methods_pkey PRIMARY KEY (id);



-- Name: hotel_subscriptions hotel_subscriptions_hotel_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_subscriptions
    ADD CONSTRAINT hotel_subscriptions_hotel_id_key UNIQUE (hotel_id);



-- Name: hotel_subscriptions hotel_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_subscriptions
    ADD CONSTRAINT hotel_subscriptions_pkey PRIMARY KEY (id);



-- Name: hotels hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);



-- Name: hotels hotels_slug_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_slug_key UNIQUE (slug);



-- Name: invoices invoices_number_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_number_key UNIQUE (number);



-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);



-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);



-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);



-- Name: payments payments_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_receipt_number_key UNIQUE (receipt_number);



-- Name: payments payments_reference_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reference_key UNIQUE (reference);



-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);



-- Name: plans plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_slug_key UNIQUE (slug);



-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);



-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);



-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);



-- Name: rooms rooms_hotel_id_room_number_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_hotel_id_room_number_key UNIQUE (hotel_id, room_number);



-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);



-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);



-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);



-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);



-- Name: ad_requests ad_requests_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ad_requests
    ADD CONSTRAINT ad_requests_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: ad_requests ad_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ad_requests
    ADD CONSTRAINT ad_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: ad_requests ad_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ad_requests
    ADD CONSTRAINT ad_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: audit_logs audit_logs_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: bookings bookings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: bookings bookings_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: bookings bookings_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE RESTRICT;



-- Name: bookings bookings_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: bookings bookings_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;



-- Name: bookings bookings_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE SET NULL;



-- Name: cash_sessions cash_sessions_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: cash_sessions cash_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: data_requests data_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.data_requests
    ADD CONSTRAINT data_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: data_requests data_requests_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.data_requests
    ADD CONSTRAINT data_requests_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: data_requests data_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.data_requests
    ADD CONSTRAINT data_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: expenses expenses_cash_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;



-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);



-- Name: expenses expenses_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: folio_items folio_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.folio_items
    ADD CONSTRAINT folio_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;



-- Name: folio_items folio_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.folio_items
    ADD CONSTRAINT folio_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: folio_items folio_items_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.folio_items
    ADD CONSTRAINT folio_items_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: guests guests_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: guests guests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: hotel_members hotel_members_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_members
    ADD CONSTRAINT hotel_members_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: hotel_members hotel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_members
    ADD CONSTRAINT hotel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



-- Name: hotel_payment_methods hotel_payment_methods_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_payment_methods
    ADD CONSTRAINT hotel_payment_methods_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: hotel_subscriptions hotel_subscriptions_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_subscriptions
    ADD CONSTRAINT hotel_subscriptions_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: hotel_subscriptions hotel_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotel_subscriptions
    ADD CONSTRAINT hotel_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;



-- Name: hotels hotels_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: invoices invoices_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: notifications notifications_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;



-- Name: payments payments_cash_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;



-- Name: payments payments_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE SET NULL;



-- Name: payments payments_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL;



-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;



-- Name: room_types room_types_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: rooms rooms_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: rooms rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE SET NULL;



-- Name: services services_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;



-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;



-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin');
$$;



-- Name: is_platform_team(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_platform_team() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('platform_admin', 'platform_support')
  );
$$;



-- Name: owns_hotel(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.owns_hotel(_hotel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = _hotel_id AND h.owner_id = auth.uid());
$$;



-- Name: user_is_platform_team(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.user_is_platform_team(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('platform_admin', 'platform_support')
  );
$$;





-- Name: user_is_hotel_person(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.user_is_hotel_person(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.hotel_members WHERE user_id = _user_id);
$$;



-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;



-- Name: hotel_commission_percent(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.hotel_commission_percent(_hotel_id uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT s.commission_percent_override FROM public.hotel_subscriptions s WHERE s.hotel_id = _hotel_id),
    (SELECT p.commission_percent FROM public.hotel_subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.hotel_id = _hotel_id),
    (SELECT ps.commission_percent FROM public.platform_settings ps WHERE ps.id),
    0
  );
$$;



-- Name: hotel_is_public(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.hotel_is_public(_hotel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h
                 WHERE h.id = _hotel_id AND h.status = 'active' AND h.is_public_listed);
$$;



-- Name: is_demo_hotel(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_demo_hotel(_hotel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = _hotel_id AND h.is_demo);
$$;



-- Name: has_hotel_access(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.has_hotel_access(_hotel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR public.owns_hotel(_hotel_id)
    OR EXISTS (SELECT 1 FROM public.hotel_members m
               WHERE m.hotel_id = _hotel_id AND m.user_id = auth.uid() AND m.is_active)
  );
$$;



-- Name: seed_platform_admin(text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.seed_platform_admin(target_email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF target_email IS NULL OR length(trim(target_email)) = 0 THEN
    RAISE EXCEPTION 'target_email is required';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(target_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'platform_admin')
  ON CONFLICT DO NOTHING;
END;
$$;



-- Name: prevent_double_booking(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.prevent_double_booking() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.room_id IS NULL OR NEW.status IN ('cancelled','no_show','checked_out') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.room_id = NEW.room_id
      AND b.id <> NEW.id
      AND b.status NOT IN ('cancelled','no_show','checked_out')
      AND daterange(b.check_in, b.check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
  ) THEN
    RAISE EXCEPTION 'This room is already booked for the selected dates';
  END IF;
  RETURN NEW;
END; $$;



-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END; $$;



-- Name: enforce_hotel_not_platform_team(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.enforce_hotel_not_platform_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND public.user_is_platform_team(NEW.owner_id) THEN
    RAISE EXCEPTION 'Platform team accounts cannot own a hotel';
  END IF;
  RETURN NEW;
END; $$;



-- Name: enforce_member_not_platform_team(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.enforce_member_not_platform_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.user_is_platform_team(NEW.user_id) THEN
    RAISE EXCEPTION 'Platform team accounts cannot be added to a hotel team';
  END IF;
  RETURN NEW;
END; $$;



-- Name: enforce_role_separation(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.enforce_role_separation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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



-- Name: bookings_hotel_dates; Type: INDEX; Schema: public; Owner: -

CREATE INDEX bookings_hotel_dates ON public.bookings USING btree (hotel_id, check_in, check_out);



-- Name: expenses_hotel_date_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX expenses_hotel_date_idx ON public.expenses USING btree (hotel_id, spent_on DESC);



-- Name: hotel_members_unique_user; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX hotel_members_unique_user ON public.hotel_members USING btree (hotel_id, user_id) WHERE (user_id IS NOT NULL);



-- Name: invoices_hotel_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX invoices_hotel_idx ON public.invoices USING btree (hotel_id, created_at DESC);



-- Name: payments_provider_reference_unique; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX payments_provider_reference_unique ON public.payments USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);



-- Name: ad_requests ad_requests_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER ad_requests_updated BEFORE UPDATE ON public.ad_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: bookings bookings_no_overlap; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER bookings_no_overlap BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.prevent_double_booking();



-- Name: bookings bookings_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: data_requests data_requests_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER data_requests_updated BEFORE UPDATE ON public.data_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: expenses expenses_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: guests guests_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER guests_updated BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: hotel_members hotel_members_not_platform_team; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER hotel_members_not_platform_team BEFORE INSERT OR UPDATE OF user_id ON public.hotel_members FOR EACH ROW EXECUTE FUNCTION public.enforce_member_not_platform_team();



-- Name: hotel_members hotel_members_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER hotel_members_updated BEFORE UPDATE ON public.hotel_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: hotel_subscriptions hotel_subscriptions_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER hotel_subscriptions_updated BEFORE UPDATE ON public.hotel_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: hotels hotels_not_platform_team; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER hotels_not_platform_team BEFORE INSERT OR UPDATE OF owner_id ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.enforce_hotel_not_platform_team();



-- Name: hotels hotels_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER hotels_updated BEFORE UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: invoices invoices_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: payments payments_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: plans plans_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: room_types room_types_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER room_types_updated BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: rooms rooms_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: services services_updated; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- Name: user_roles user_roles_role_separation; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER user_roles_role_separation BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.enforce_role_separation();



-- Name: ad_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.ad_requests ENABLE ROW LEVEL SECURITY;


-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;


-- Name: cash_sessions; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;


-- Name: data_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;


-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;


-- Name: folio_items; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.folio_items ENABLE ROW LEVEL SECURITY;


-- Name: guests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;


-- Name: hotel_members; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.hotel_members ENABLE ROW LEVEL SECURITY;


-- Name: hotel_payment_methods; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.hotel_payment_methods ENABLE ROW LEVEL SECURITY;


-- Name: hotel_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.hotel_subscriptions ENABLE ROW LEVEL SECURITY;


-- Name: hotels; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;


-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;


-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;


-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;


-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Name: room_types; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;


-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;


-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;


-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- Name: plans Anyone can view active plans; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING ((is_active OR public.is_platform_team()));



-- Name: expenses Hotel people manage their expenses; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel people manage their expenses" ON public.expenses TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: ad_requests Hotel team and platform team can view ad requests; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team and platform team can view ad requests" ON public.ad_requests FOR SELECT TO authenticated USING ((public.is_platform_team() OR public.has_hotel_access(hotel_id)));



-- Name: data_requests Hotel team and platform team can view data requests; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team and platform team can view data requests" ON public.data_requests FOR SELECT TO authenticated USING ((public.is_platform_team() OR public.has_hotel_access(hotel_id)));



-- Name: invoices Hotel team and platform team can view invoices; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team and platform team can view invoices" ON public.invoices FOR SELECT TO authenticated USING ((public.is_platform_team() OR public.has_hotel_access(hotel_id)));



-- Name: hotel_subscriptions Hotel team and platform team can view subscriptions; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team and platform team can view subscriptions" ON public.hotel_subscriptions FOR SELECT TO authenticated USING ((public.is_platform_team() OR public.has_hotel_access(hotel_id)));



-- Name: data_requests Hotel team can raise data requests; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team can raise data requests" ON public.data_requests FOR INSERT TO authenticated WITH CHECK ((public.has_hotel_access(hotel_id) AND (requested_by = auth.uid())));



-- Name: ad_requests Hotel team can request ads; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "Hotel team can request ads" ON public.ad_requests FOR INSERT TO authenticated WITH CHECK ((public.has_hotel_access(hotel_id) AND (requested_by = auth.uid())));



-- Name: audit_logs audit_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);



-- Name: audit_logs audit_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated USING ((public.is_platform_admin() OR ((hotel_id IS NOT NULL) AND public.has_hotel_access(hotel_id))));



-- Name: bookings bookings_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY bookings_tenant_all ON public.bookings TO authenticated USING ((public.has_hotel_access(hotel_id) OR (customer_user_id = auth.uid()))) WITH CHECK ((public.has_hotel_access(hotel_id) OR (customer_user_id = auth.uid())));



-- Name: cash_sessions cash_sessions_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cash_sessions_tenant_all ON public.cash_sessions TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: folio_items folio_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY folio_tenant_all ON public.folio_items TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: guests guests_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY guests_tenant_all ON public.guests TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: hotel_members hotel_members_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotel_members_read ON public.hotel_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_hotel_access(hotel_id)));



-- Name: hotel_members hotel_members_write; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotel_members_write ON public.hotel_members TO authenticated USING ((public.owns_hotel(hotel_id) OR public.is_platform_admin() OR public.is_demo_hotel(hotel_id))) WITH CHECK ((public.owns_hotel(hotel_id) OR public.is_platform_admin() OR public.is_demo_hotel(hotel_id)));



-- Name: hotels hotels_admin_delete; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotels_admin_delete ON public.hotels FOR DELETE TO authenticated USING (public.is_platform_admin());



-- Name: hotels hotels_member_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotels_member_read ON public.hotels FOR SELECT TO authenticated USING (public.has_hotel_access(id));



-- Name: hotels hotels_owner_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotels_owner_insert ON public.hotels FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));



-- Name: hotels hotels_owner_update; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotels_owner_update ON public.hotels FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR public.is_platform_admin() OR public.is_demo_hotel(id))) WITH CHECK (((owner_id = auth.uid()) OR public.is_platform_admin() OR public.is_demo_hotel(id)));



-- Name: hotels hotels_public_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hotels_public_read ON public.hotels FOR SELECT USING (((status = 'active'::public.hotel_status) AND is_public_listed));



-- Name: hotel_payment_methods hpm_public_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hpm_public_read ON public.hotel_payment_methods FOR SELECT USING (public.hotel_is_public(hotel_id));



-- Name: hotel_payment_methods hpm_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY hpm_tenant_all ON public.hotel_payment_methods TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: notifications notifications_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);



-- Name: notifications notifications_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY notifications_own ON public.notifications FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ((hotel_id IS NOT NULL) AND public.has_hotel_access(hotel_id))));



-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR ((hotel_id IS NOT NULL) AND public.has_hotel_access(hotel_id))));



-- Name: payments payments_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY payments_tenant_all ON public.payments TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: platform_settings platform_settings_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY platform_settings_read ON public.platform_settings FOR SELECT USING (true);



-- Name: platform_settings platform_settings_write; Type: POLICY; Schema: public; Owner: -

CREATE POLICY platform_settings_write ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());



-- Name: profiles profiles_insert_self; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));



-- Name: profiles profiles_select_self_or_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_platform_admin()));



-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.is_platform_admin()));



-- Name: room_types room_types_public_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY room_types_public_read ON public.room_types FOR SELECT USING (public.hotel_is_public(hotel_id));



-- Name: room_types room_types_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY room_types_tenant_all ON public.room_types TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: rooms rooms_public_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY rooms_public_read ON public.rooms FOR SELECT USING (public.hotel_is_public(hotel_id));



-- Name: rooms rooms_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY rooms_tenant_all ON public.rooms TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: services services_public_read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY services_public_read ON public.services FOR SELECT USING (public.hotel_is_public(hotel_id));



-- Name: services services_tenant_all; Type: POLICY; Schema: public; Owner: -

CREATE POLICY services_tenant_all ON public.services TO authenticated USING (public.has_hotel_access(hotel_id)) WITH CHECK (public.has_hotel_access(hotel_id));



-- Name: user_roles user_roles_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_platform_admin()));



-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;



-- Name: FUNCTION enforce_hotel_not_platform_team(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.enforce_hotel_not_platform_team() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_hotel_not_platform_team() TO service_role;



-- Name: FUNCTION enforce_member_not_platform_team(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.enforce_member_not_platform_team() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_member_not_platform_team() TO service_role;



-- Name: FUNCTION enforce_role_separation(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.enforce_role_separation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_role_separation() TO service_role;



-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;



-- Name: FUNCTION has_hotel_access(_hotel_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.has_hotel_access(_hotel_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_hotel_access(_hotel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_hotel_access(_hotel_id uuid) TO service_role;



-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;



-- Name: FUNCTION hotel_commission_percent(_hotel_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.hotel_commission_percent(_hotel_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hotel_commission_percent(_hotel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.hotel_commission_percent(_hotel_id uuid) TO service_role;



-- Name: FUNCTION hotel_is_public(_hotel_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.hotel_is_public(_hotel_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hotel_is_public(_hotel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.hotel_is_public(_hotel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.hotel_is_public(_hotel_id uuid) TO service_role;



-- Name: FUNCTION is_demo_hotel(_hotel_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.is_demo_hotel(_hotel_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_demo_hotel(_hotel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_demo_hotel(_hotel_id uuid) TO service_role;



-- Name: FUNCTION is_platform_admin(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin() TO service_role;



-- Name: FUNCTION is_platform_team(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.is_platform_team() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_platform_team() TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_team() TO service_role;



-- Name: FUNCTION owns_hotel(_hotel_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.owns_hotel(_hotel_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_hotel(_hotel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_hotel(_hotel_id uuid) TO service_role;



-- Name: FUNCTION prevent_double_booking(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.prevent_double_booking() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_double_booking() TO service_role;



-- Name: FUNCTION seed_platform_admin(target_email text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.seed_platform_admin(target_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_platform_admin(target_email text) TO service_role;



-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;



-- Name: FUNCTION user_is_hotel_person(_user_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.user_is_hotel_person(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_is_hotel_person(_user_id uuid) TO service_role;



-- Name: FUNCTION user_is_platform_team(_user_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.user_is_platform_team(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_is_platform_team(_user_id uuid) TO service_role;



-- Name: TABLE ad_requests; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.ad_requests TO anon;
GRANT ALL ON TABLE public.ad_requests TO authenticated;
GRANT ALL ON TABLE public.ad_requests TO service_role;



-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;



-- Name: SEQUENCE booking_reference_seq; Type: ACL; Schema: public; Owner: -

GRANT ALL ON SEQUENCE public.booking_reference_seq TO anon;
GRANT ALL ON SEQUENCE public.booking_reference_seq TO authenticated;
GRANT ALL ON SEQUENCE public.booking_reference_seq TO service_role;



-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;



-- Name: TABLE cash_sessions; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.cash_sessions TO anon;
GRANT ALL ON TABLE public.cash_sessions TO authenticated;
GRANT ALL ON TABLE public.cash_sessions TO service_role;



-- Name: TABLE data_requests; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.data_requests TO anon;
GRANT ALL ON TABLE public.data_requests TO authenticated;
GRANT ALL ON TABLE public.data_requests TO service_role;



-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;



-- Name: TABLE folio_items; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.folio_items TO anon;
GRANT ALL ON TABLE public.folio_items TO authenticated;
GRANT ALL ON TABLE public.folio_items TO service_role;



-- Name: TABLE guests; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.guests TO anon;
GRANT ALL ON TABLE public.guests TO authenticated;
GRANT ALL ON TABLE public.guests TO service_role;



-- Name: TABLE hotel_members; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.hotel_members TO anon;
GRANT ALL ON TABLE public.hotel_members TO authenticated;
GRANT ALL ON TABLE public.hotel_members TO service_role;



-- Name: TABLE hotel_payment_methods; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.hotel_payment_methods TO anon;
GRANT ALL ON TABLE public.hotel_payment_methods TO authenticated;
GRANT ALL ON TABLE public.hotel_payment_methods TO service_role;



-- Name: TABLE hotel_subscriptions; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.hotel_subscriptions TO anon;
GRANT ALL ON TABLE public.hotel_subscriptions TO authenticated;
GRANT ALL ON TABLE public.hotel_subscriptions TO service_role;



-- Name: TABLE hotels; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.hotels TO anon;
GRANT ALL ON TABLE public.hotels TO authenticated;
GRANT ALL ON TABLE public.hotels TO service_role;



-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;



-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;



-- Name: SEQUENCE payment_reference_seq; Type: ACL; Schema: public; Owner: -

GRANT ALL ON SEQUENCE public.payment_reference_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_reference_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_reference_seq TO service_role;



-- Name: SEQUENCE receipt_number_seq; Type: ACL; Schema: public; Owner: -

GRANT ALL ON SEQUENCE public.receipt_number_seq TO anon;
GRANT ALL ON SEQUENCE public.receipt_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.receipt_number_seq TO service_role;



-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;



-- Name: TABLE plans; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.plans TO anon;
GRANT ALL ON TABLE public.plans TO authenticated;
GRANT ALL ON TABLE public.plans TO service_role;



-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;



-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;



-- Name: TABLE room_types; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.room_types TO anon;
GRANT ALL ON TABLE public.room_types TO authenticated;
GRANT ALL ON TABLE public.room_types TO service_role;



-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.rooms TO anon;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO service_role;



-- Name: TABLE services; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;



-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;





























--


-- Storage: the private "hotel-media" bucket must exist before these policies.
-- (Buckets are created through the platform's storage tooling, not SQL.)
--
DROP POLICY IF EXISTS "hotel media readable" ON storage.objects;
CREATE POLICY "hotel media readable" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'hotel-media');

DROP POLICY IF EXISTS "hotel team uploads media" ON storage.objects;
CREATE POLICY "hotel team uploads media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hotel-media' AND public.has_hotel_access(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "hotel team updates media" ON storage.objects;
CREATE POLICY "hotel team updates media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hotel-media' AND public.has_hotel_access(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "hotel team deletes media" ON storage.objects;
CREATE POLICY "hotel team deletes media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hotel-media' AND public.has_hotel_access(((storage.foldername(name))[1])::uuid));

--
-- Sign-up hook: create the profile + default role for each new account.
--
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
