-- Menu lokalu moze byc wgrane jako PDF (frontend: accept="image/*,application/pdf",
-- contentType application/pdf, isPdfUrl w wizytowce). Bucket business-photos nie mial
-- application/pdf w allowed_mime_types -> Storage odrzucal upload:
-- "mime type application/pdf is not supported". Dodajemy PDF.
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['application/pdf']
)
WHERE id = 'business-photos'
  AND NOT ('application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));

-- 5MB bywa za malo dla PDF menu / wideo -> podnosimy limit do 10MB.
UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'business-photos'
  AND COALESCE(file_size_limit, 0) < 10485760;
