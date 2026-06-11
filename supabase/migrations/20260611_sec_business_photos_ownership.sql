-- [H1] bucket business-photos mial INSERT/UPDATE/DELETE tylko na (bucket_id =
-- 'business-photos') -> kazdy zalogowany mogl nadpisac/usunac CUDZE zdjecia.
-- Sciezka uploadu (BusinessDashboard) = `${profile.id ?? placeId}/folder/...`,
-- wiec pierwszy segment to business_profiles.id albo place_id. Gatujemy do
-- wlasciciela danej wizytowki. Public SELECT zostaje (zdjecia sa publiczne).
DROP POLICY IF EXISTS "Authenticated users can upload business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business photos" ON storage.objects;

CREATE POLICY "Owner can upload business photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-photos' AND EXISTS (
      SELECT 1 FROM public.business_profiles bp
      WHERE bp.owner_user_id = auth.uid()
        AND ((storage.foldername(name))[1] = bp.id::text
          OR (storage.foldername(name))[1] = bp.place_id::text)
    )
  );

CREATE POLICY "Owner can update business photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-photos' AND EXISTS (
      SELECT 1 FROM public.business_profiles bp
      WHERE bp.owner_user_id = auth.uid()
        AND ((storage.foldername(name))[1] = bp.id::text
          OR (storage.foldername(name))[1] = bp.place_id::text)
    )
  );

CREATE POLICY "Owner can delete business photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-photos' AND EXISTS (
      SELECT 1 FROM public.business_profiles bp
      WHERE bp.owner_user_id = auth.uid()
        AND ((storage.foldername(name))[1] = bp.id::text
          OR (storage.foldername(name))[1] = bp.place_id::text)
    )
  );
