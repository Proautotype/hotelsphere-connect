DROP POLICY IF EXISTS "hotel media readable" ON storage.objects;
CREATE POLICY "hotel media readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'hotel-media');

DROP POLICY IF EXISTS "hotel team uploads media" ON storage.objects;
CREATE POLICY "hotel team uploads media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hotel-media'
  AND public.has_hotel_access(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "hotel team updates media" ON storage.objects;
CREATE POLICY "hotel team updates media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hotel-media'
  AND public.has_hotel_access(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "hotel team deletes media" ON storage.objects;
CREATE POLICY "hotel team deletes media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'hotel-media'
  AND public.has_hotel_access(((storage.foldername(name))[1])::uuid)
);