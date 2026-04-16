-- Create business-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-photos',
  'business-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload business photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload business photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-photos');

-- Allow authenticated users to update (upsert)
DROP POLICY IF EXISTS "Authenticated users can update business photos" ON storage.objects;
CREATE POLICY "Authenticated users can update business photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-photos');

-- Allow authenticated users to delete their own uploads
DROP POLICY IF EXISTS "Authenticated users can delete business photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete business photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-photos');

-- Public read access
DROP POLICY IF EXISTS "Business photos are publicly readable" ON storage.objects;
CREATE POLICY "Business photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-photos');
