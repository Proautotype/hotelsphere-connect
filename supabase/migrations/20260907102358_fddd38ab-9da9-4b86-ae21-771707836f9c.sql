CREATE TYPE public.expense_category AS ENUM ('utilities','supplies','salaries','maintenance','food_drink','transport','marketing','rent','taxes_fees','other');

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  spent_on date NOT NULL DEFAULT current_date,
  category public.expense_category NOT NULL DEFAULT 'other',
  vendor text NOT NULL DEFAULT '',
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_hotel_date_idx ON public.expenses (hotel_id, spent_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel people manage their expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();