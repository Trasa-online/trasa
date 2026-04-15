-- Cache dla Google Places Details API
-- Każde unikalne miejsce (name+city) jest fetchowane raz na 7 dni
-- zamiast przy każdym kliknięciu w drawer

CREATE TABLE IF NOT EXISTS public.place_details_cache (
  cache_key   TEXT PRIMARY KEY,           -- lower(place_name || '|' || city)
  data        JSONB NOT NULL,             -- pełna odpowiedź z Google Places Details
  cached_at   TIMESTAMPTZ DEFAULT now()
);

-- Tylko Edge Functions (service_role) mogą pisać; wszyscy mogą czytać
ALTER TABLE public.place_details_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON public.place_details_cache FOR SELECT USING (true);

CREATE POLICY "Service role write"
  ON public.place_details_cache FOR ALL USING (auth.role() = 'service_role');

-- Auto-czyszczenie wpisów starszych niż 7 dni (uruchamiane przez pg_cron jeśli dostępny)
-- Alternatywnie edge function sama usuwa stare wpisy przy zapisie
CREATE INDEX IF NOT EXISTS idx_place_details_cache_cached_at
  ON public.place_details_cache (cached_at);

COMMENT ON TABLE public.place_details_cache IS
  'Cache for Google Places Details API responses. TTL: 7 days. '
  'Reduces API costs from $0.017/call to ~$0.017/place/week.';
