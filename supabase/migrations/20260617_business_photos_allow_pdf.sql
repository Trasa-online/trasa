-- Menu/cennik biznesu moze byc teraz takze PDF (nie tylko JPG/PNG/WEBP).
-- Bucket 'business-photos' mial allowed_mime_types tylko dla obrazow + limit 5MB.
-- Dodajemy application/pdf i podnosimy limit do 10MB (PDF bywa wiekszy niz zdjecie).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 10485760
WHERE id = 'business-photos';
