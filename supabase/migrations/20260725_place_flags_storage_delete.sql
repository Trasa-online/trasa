-- Moderator (admin) może usuwać zdjęcia z cache (bucket place-photos-cache), żeby po
-- fladze „złe zdjęcie" wyczyścić cache i wymusić re-fetch. DELETE w tym buckecie było
-- dotąd tylko dla service_role - dokładamy ścieżkę admina (has_role).
create policy "admin_delete_place_photos_cache" on storage.objects
  for delete to authenticated
  using (bucket_id = 'place-photos-cache' and public.has_role(auth.uid(), 'admin'));
