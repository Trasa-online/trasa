-- Add google_place_id column to places table.
-- When the proxy resolves a place by name search, it will store the Place ID here
-- so subsequent fetches skip the unreliable text search entirely.

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

CREATE INDEX IF NOT EXISTS places_google_place_id_idx ON public.places (google_place_id)
  WHERE google_place_id IS NOT NULL;
