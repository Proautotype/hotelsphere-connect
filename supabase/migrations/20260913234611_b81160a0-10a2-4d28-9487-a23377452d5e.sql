ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS early_checkout_withhold_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_checkout_withhold_flat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withheld_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_checkout boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'charge';

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('charge','refund'));