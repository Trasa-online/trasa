-- =====================================================================
-- Place Photos Cache: persistent Google Photos in Supabase Storage
-- =====================================================================
-- Cele:
--  1. Stworzyć bucket Storage `place-photos-cache` na zdjęcia 400px + 800px
--  2. Dodać kolumny pins.photo_url, pins.photo_cached_at do persystencji adresu
--  3. Dodać places.photo_cached_at do trackingu kiedy ostatnio cache'owane
--  4. Index na pins.id WHERE photo_url IS NULL dla szybkiego backfillu
-- =====================================================================

-- ── 1. Storage bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'place-photos-cache',
  'place-photos-cache',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Public read access (każdy może wyświetlić zdjęcie)
DROP POLICY IF EXISTS "Place photos cache is publicly readable" ON storage.objects;
CREATE POLICY "Place photos cache is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-photos-cache');

-- Service role może wstawiać/aktualizować/usuwać (edge function używa service key)
-- (Service role bypasses RLS, ale dla jawności definiujemy polityki)
DROP POLICY IF EXISTS "Service role can manage place photos cache" ON storage.objects;
CREATE POLICY "Service role can manage place photos cache"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'place-photos-cache')
  WITH CHECK (bucket_id = 'place-photos-cache');

-- ── 2. pins.photo_url + photo_cached_at ───────────────────────────────
ALTER TABLE public.pins
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_cached_at TIMESTAMPTZ;

-- ── 3. places.photo_cached_at ─────────────────────────────────────────
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS photo_cached_at TIMESTAMPTZ;

-- ── 4. Indexy na backfill ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pins_photo_url_null
  ON public.pins (id) WHERE photo_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_places_photo_cached_at_null
  ON public.places (id) WHERE photo_cached_at IS NULL;
