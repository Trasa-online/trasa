-- =============================================================================
-- places.gallery_urls
-- =============================================================================
-- Dodatkowe zdjęcia per miejsce (poza cover photo_url). Wypełniane przez
-- scripts/backfill-place-galleries.ts z Google Places API + Supabase Storage.
--
-- UI: SwipeCard i PlaceSwiperDetail składają wszystkie zdjęcia do galerii z:
--   place.photo_url (cover)
--   + business_profiles.gallery_urls (zdjęcia od właściciela)
--   + places.gallery_urls (NOWE - kurowane / scache'owane z Google)
-- =============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN public.places.gallery_urls IS
  'Dodatkowe zdjęcia (gallery). URL-e do Supabase Storage (bucket place-photos-cache) lub /api/place-photo?ref=...';

-- Index do szybkiego znajdowania miejsc bez galerii (do backfillu)
CREATE INDEX IF NOT EXISTS idx_places_gallery_empty
  ON public.places (city)
  WHERE cardinality(gallery_urls) = 0;
