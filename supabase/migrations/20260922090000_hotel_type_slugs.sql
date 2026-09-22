-- Property types were written two ways: the registration form saved Title Case
-- labels ("Guest House", "Hostel") while the rest of the app compares against
-- the lowercase slugs in src/lib/permissions.ts. Nothing matched, so the
-- /discover type filter never found anything and hostel features stayed hidden.
-- Settle on the slugs and fold the extra labels into the nearest one.

UPDATE public.hotels
SET hotel_type = CASE lower(trim(hotel_type))
  WHEN 'guest house' THEN 'guesthouse'
  WHEN 'boutique hotel' THEN 'boutique'
  WHEN 'serviced apartment' THEN 'apartment'
  WHEN 'airbnb / vacation rental' THEN 'apartment'
  WHEN 'conference hotel' THEN 'hotel'
  WHEN 'motel' THEN 'other'
  WHEN 'lodge' THEN 'other'
  ELSE lower(trim(hotel_type))
END;

-- Anything that still isn't one of the eight known slugs becomes 'other' rather
-- than staying invisible to the filters.
UPDATE public.hotels
SET hotel_type = 'other'
WHERE hotel_type NOT IN
  ('hotel', 'guesthouse', 'bnb', 'apartment', 'hostel', 'resort', 'boutique', 'other');

-- Hostels can now actually be recognised, so give them the mode that lets them
-- sell dorm beds per stay alongside per-night rooms.
UPDATE public.hotels
SET operating_mode = 'flexible'
WHERE hotel_type = 'hostel' AND operating_mode = 'short_term';
