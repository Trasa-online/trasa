-- Allow video MIME types in business-photos storage bucket
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['video/mp4', 'video/quicktime', 'video/mov', 'video/mpeg', 'video/webm']
)
WHERE id = 'business-photos';
