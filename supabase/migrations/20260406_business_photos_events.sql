-- Add gallery photos + event fields to business_profiles
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS gallery_urls  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS event_title       TEXT,
  ADD COLUMN IF NOT EXISTS event_description TEXT,
  ADD COLUMN IF NOT EXISTS event_starts_at   DATE,
  ADD COLUMN IF NOT EXISTS event_ends_at     DATE;

-- Storage bucket for business photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-photos', 'business-photos', true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Business photos publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'business-photos');

CREATE POLICY "Authenticated users can upload business photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete business photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'business-photos' AND auth.uid() IS NOT NULL);
