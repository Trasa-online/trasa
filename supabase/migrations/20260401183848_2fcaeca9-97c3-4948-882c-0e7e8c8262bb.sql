
CREATE TABLE public.place_details_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  place_id text,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days'
);

ALTER TABLE public.place_details_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read place details cache"
ON public.place_details_cache
FOR SELECT
USING (true);

CREATE INDEX idx_place_details_cache_key ON public.place_details_cache (cache_key);
CREATE INDEX idx_place_details_cache_expires ON public.place_details_cache (expires_at);
