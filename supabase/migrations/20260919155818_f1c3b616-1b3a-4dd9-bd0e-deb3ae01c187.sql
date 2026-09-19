CREATE TYPE public.channel_provider AS ENUM ('booking_com','expedia','airbnb','agoda','vrbo','other');
CREATE TYPE public.channel_mode AS ENUM ('ical','api');
CREATE TYPE public.channel_status AS ENUM ('active','paused','error','awaiting_credentials');

CREATE TABLE public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  provider public.channel_provider NOT NULL DEFAULT 'other',
  label text NOT NULL DEFAULT '',
  mode public.channel_mode NOT NULL DEFAULT 'ical',
  room_type_id uuid REFERENCES public.room_types(id) ON DELETE SET NULL,
  import_url text,
  export_token uuid NOT NULL DEFAULT gen_random_uuid(),
  api_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.channel_status NOT NULL DEFAULT 'active',
  auto_sync boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_ok boolean,
  last_sync_message text,
  imported_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX channel_connections_export_token_key ON public.channel_connections(export_token);
CREATE INDEX channel_connections_hotel_idx ON public.channel_connections(hotel_id);

CREATE TABLE public.channel_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  external_uid text NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  summary text NOT NULL DEFAULT '',
  check_in date NOT NULL,
  check_out date NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX channel_bookings_uid_key ON public.channel_bookings(connection_id, external_uid);
CREATE INDEX channel_bookings_hotel_idx ON public.channel_bookings(hotel_id);

CREATE TABLE public.channel_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'import',
  ok boolean NOT NULL DEFAULT true,
  message text NOT NULL DEFAULT '',
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channel_sync_logs_connection_idx ON public.channel_sync_logs(connection_id, created_at DESC);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS channel_connection_id uuid REFERENCES public.channel_connections(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO authenticated;
GRANT ALL ON public.channel_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_bookings TO authenticated;
GRANT ALL ON public.channel_bookings TO service_role;
GRANT SELECT, INSERT ON public.channel_sync_logs TO authenticated;
GRANT ALL ON public.channel_sync_logs TO service_role;

ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel team manages channels" ON public.channel_connections
  FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE POLICY "Hotel team manages channel bookings" ON public.channel_bookings
  FOR ALL TO authenticated
  USING (public.has_hotel_access(hotel_id))
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE POLICY "Hotel team reads sync logs" ON public.channel_sync_logs
  FOR SELECT TO authenticated
  USING (public.has_hotel_access(hotel_id));

CREATE POLICY "Hotel team writes sync logs" ON public.channel_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_hotel_access(hotel_id));

CREATE TRIGGER channel_connections_updated BEFORE UPDATE ON public.channel_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER channel_bookings_updated BEFORE UPDATE ON public.channel_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();