-- 1. Clear all business data
DELETE FROM public.folio_items;
DELETE FROM public.payments;
DELETE FROM public.bookings;
DELETE FROM public.cash_sessions;
DELETE FROM public.guests;
DELETE FROM public.rooms;
DELETE FROM public.room_types;
DELETE FROM public.services;
DELETE FROM public.hotel_payment_methods;
DELETE FROM public.hotel_members;
DELETE FROM public.notifications;
DELETE FROM public.audit_logs;
DELETE FROM public.hotels;

-- 2. Reset roles: single platform admin, single hotel owner
DELETE FROM public.user_roles;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'platform_admin'::app_role FROM auth.users WHERE lower(email) = 'admin@custardhotels.com';
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'hotel_owner'::app_role FROM auth.users WHERE lower(email) = 'winstyngyen@gmail.com';
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'customer'::app_role FROM auth.users
WHERE lower(email) NOT IN ('admin@custardhotels.com', 'winstyngyen@gmail.com');

-- 3. Two hotels for the owner
INSERT INTO public.hotels (
  id, owner_id, name, slug, description, hotel_type, address, city, region, country,
  phone, email, currency, timezone, check_in_time, check_out_time,
  tax_percent, service_charge_percent, cancellation_policy, status,
  is_public_listed, accept_online_bookings, show_prices, show_availability,
  is_featured, rating, room_count, amenities, onboarding_step, onboarding_completed, is_demo
)
SELECT
  '11111111-1111-4111-8111-111111111111', u.id,
  'Custard Bay Resort', 'custard-bay-resort',
  'Beachfront resort in Accra with sea-view rooms, a pool and an all-day restaurant.',
  'resort', '12 Marine Drive, Labadi', 'Accra', 'Greater Accra', 'Ghana',
  '+233201234567', 'stay@custardbay.com', 'GHS', 'Africa/Accra', '14:00', '11:00',
  15, 5, 'Free cancellation up to 48 hours before check-in.', 'active',
  true, true, true, true, true, 4.6, 10,
  ARRAY['Free WiFi','Pool','Restaurant','Airport shuttle','Air conditioning','Parking'],
  6, true, false
FROM auth.users u WHERE lower(u.email) = 'winstyngyen@gmail.com';

INSERT INTO public.hotels (
  id, owner_id, name, slug, description, hotel_type, address, city, region, country,
  phone, email, currency, timezone, check_in_time, check_out_time,
  tax_percent, service_charge_percent, cancellation_policy, status,
  is_public_listed, accept_online_bookings, show_prices, show_availability,
  is_featured, rating, room_count, amenities, onboarding_step, onboarding_completed, is_demo
)
SELECT
  '22222222-2222-4222-8222-222222222222', u.id,
  'Ashanti Palm Hotel', 'ashanti-palm-hotel',
  'Modern city hotel in central Kumasi, minutes from the cultural centre and markets.',
  'hotel', '5 Prempeh II Street', 'Kumasi', 'Ashanti', 'Ghana',
  '+233207654321', 'reservations@ashantipalm.com', 'GHS', 'Africa/Accra', '14:00', '12:00',
  15, 5, 'Free cancellation up to 24 hours before check-in.', 'active',
  true, true, true, true, false, 4.3, 8,
  ARRAY['Free WiFi','Restaurant','Conference room','Air conditioning','Parking'],
  6, true, false
FROM auth.users u WHERE lower(u.email) = 'winstyngyen@gmail.com';

-- 4. Room types
INSERT INTO public.room_types (id, hotel_id, name, description, max_guests, bed_count, bed_type, base_price, amenities, is_active) VALUES
('aaaaaaa1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Standard Double', 'Comfortable double room with garden view.', 2, 1, 'Double', 450, ARRAY['WiFi','TV','Air conditioning'], true),
('aaaaaaa1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Sea View Deluxe', 'Spacious room with private balcony facing the ocean.', 3, 1, 'King', 780, ARRAY['WiFi','TV','Air conditioning','Balcony','Mini bar'], true),
('aaaaaaa1-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Family Suite', 'Two-bedroom suite with lounge, ideal for families.', 5, 3, 'Mixed', 1250, ARRAY['WiFi','TV','Air conditioning','Kitchenette','Lounge'], true),
('bbbbbbb2-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'City Single', 'Cosy single room for business travellers.', 1, 1, 'Single', 320, ARRAY['WiFi','TV','Desk'], true),
('bbbbbbb2-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Executive Twin', 'Twin room with workspace and city view.', 2, 2, 'Twin', 560, ARRAY['WiFi','TV','Air conditioning','Desk'], true);

-- 5. Rooms
INSERT INTO public.rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT '11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000001', '10' || g, '1', 'available'
FROM generate_series(1,4) g;
INSERT INTO public.rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT '11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000002', '20' || g, '2', 'available'
FROM generate_series(1,4) g;
INSERT INTO public.rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT '11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000003', '30' || g, '3', 'available'
FROM generate_series(1,2) g;
INSERT INTO public.rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT '22222222-2222-4222-8222-222222222222', 'bbbbbbb2-0000-4000-8000-000000000001', '10' || g, '1', 'available'
FROM generate_series(1,4) g;
INSERT INTO public.rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT '22222222-2222-4222-8222-222222222222', 'bbbbbbb2-0000-4000-8000-000000000002', '20' || g, '2', 'available'
FROM generate_series(1,4) g;

-- 6. Services
INSERT INTO public.services (hotel_id, name, description, category, price, is_active) VALUES
('11111111-1111-4111-8111-111111111111', 'Breakfast buffet', 'Full breakfast served 6:30-10:30.', 'food', 85, true),
('11111111-1111-4111-8111-111111111111', 'Airport transfer', 'One-way transfer to Kotoka International.', 'transport', 200, true),
('11111111-1111-4111-8111-111111111111', 'Laundry', 'Same-day laundry service per load.', 'housekeeping', 60, true),
('22222222-2222-4222-8222-222222222222', 'Breakfast', 'Continental breakfast.', 'food', 65, true),
('22222222-2222-4222-8222-222222222222', 'Conference room', 'Half-day meeting room hire.', 'business', 900, true);

-- 7. Payment methods
INSERT INTO public.hotel_payment_methods (hotel_id, method, provider, is_enabled, config)
SELECT h.id, m.method::payment_method, CASE WHEN m.method = 'mobile_money' THEN 'paystack' ELSE 'manual' END, true, '{}'::jsonb
FROM public.hotels h
CROSS JOIN (VALUES ('cash'), ('mobile_money'), ('bank_transfer')) AS m(method);