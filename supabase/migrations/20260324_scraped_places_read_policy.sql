-- Allow any authenticated or anonymous user to read scraped_places
-- (data is public city/influencer content, no PII)
ALTER TABLE public.scraped_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scraped_places"
  ON public.scraped_places
  FOR SELECT
  USING (true);
