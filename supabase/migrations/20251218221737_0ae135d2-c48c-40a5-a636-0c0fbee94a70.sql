-- Create a storage bucket for pin placeholders
INSERT INTO storage.buckets (id, name, public)
VALUES ('placeholders', 'placeholders', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to placeholders
CREATE POLICY "Public read access for placeholders"
ON storage.objects FOR SELECT
USING (bucket_id = 'placeholders');

-- Allow authenticated users to upload placeholders (for admin use)
CREATE POLICY "Authenticated users can upload placeholders"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'placeholders' AND auth.role() = 'authenticated');