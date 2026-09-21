-- Hostel mode: semester / long-term stays priced flat per stay, and
-- multi-occupant rooms (dormitory beds). Each occupant of a per-stay room
-- pays the same flat price the owner sets for the whole stay period.

-- 1. hotels: operating mode
ALTER TABLE public.hotels
  ADD COLUMN operating_mode text NOT NULL DEFAULT 'short_term',
  ADD CONSTRAINT hotels_operating_mode_check
    CHECK (operating_mode IN ('short_term', 'long_term', 'flexible'));

-- 2. room_types: pricing model (per night vs flat per stay)
ALTER TABLE public.room_types
  ADD COLUMN pricing_model text NOT NULL DEFAULT 'per_night',
  ADD COLUMN per_stay_price numeric(12,2),
  ADD CONSTRAINT room_types_pricing_model_check
    CHECK (pricing_model IN ('per_night', 'per_stay')),
  ADD CONSTRAINT room_types_per_stay_price_check
    CHECK (per_stay_price IS NULL OR per_stay_price >= 0);

-- 3. bookings: check_out optional (open-ended semester stays), nights null-safe
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_check;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS nights;
ALTER TABLE public.bookings
  ALTER COLUMN check_out DROP NOT NULL,
  ADD COLUMN nights integer
    GENERATED ALWAYS AS (
      CASE WHEN check_out IS NULL THEN NULL
           ELSE GREATEST((check_out - check_in), 1) END
    ) STORED,
  ADD COLUMN pricing_model text NOT NULL DEFAULT 'per_night',
  ADD CONSTRAINT bookings_check CHECK (check_out IS NULL OR check_out > check_in),
  ADD CONSTRAINT bookings_pricing_model_check
    CHECK (pricing_model IN ('per_night', 'per_stay'));

-- 4. occupancies: one row per person occupying a (bed in a) room for a stay
CREATE TABLE public.occupancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  bed_number text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'checked_in', 'checked_out', 'cancelled')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX occupancies_hotel_idx ON public.occupancies(hotel_id);
CREATE INDEX occupancies_booking_idx ON public.occupancies(booking_id);
CREATE INDEX occupancies_room_status_idx ON public.occupancies(room_id, status);

ALTER TABLE public.occupancies ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.occupancies TO service_role;

CREATE POLICY "Hotel people manage occupancies" ON public.occupancies
  FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE TRIGGER occupancies_updated BEFORE UPDATE ON public.occupancies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Backfill one occupancy per existing booking so guest lists stay consistent.
INSERT INTO public.occupancies (hotel_id, booking_id, guest_id, room_id, bed_number, price, status, checked_in_at, checked_out_at)
SELECT
  b.hotel_id,
  b.id,
  b.guest_id,
  b.room_id,
  NULL,
  CASE WHEN b.pricing_model = 'per_stay' THEN b.room_rate
       ELSE round((b.room_rate * GREATEST((b.check_out - b.check_in), 1))::numeric, 2) END,
  'checked_in',
  b.checked_in_at,
  b.checked_out_at
FROM public.bookings b
ON CONFLICT DO NOTHING;