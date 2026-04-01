-- Create place_photo_cache table
CREATE TABLE public.place_photo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_reference text NOT NULL UNIQUE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.place_photo_cache ENABLE ROW LEVEL SECURITY;

-- Everyone can read cached photos
CREATE POLICY "Anyone can read photo cache"
  ON public.place_photo_cache
  FOR SELECT
  USING (true);

-- Create storage bucket for cached photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('place-photos', 'place-photos', true);

-- Public read access for place-photos bucket
CREATE POLICY "Public read access for place photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'place-photos');

-- Service role can insert place photos (edge function uses service role)
CREATE POLICY "Service role can insert place photos"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'place-photos');

-- Service role can delete place photos
CREATE POLICY "Service role can delete place photos"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'place-photos');