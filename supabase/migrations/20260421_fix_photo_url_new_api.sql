-- Fix photo_url entries that use AU_... (New Places API) photo references
-- without the required place_id parameter.
-- The new Google Places API v1 endpoint requires:
--   places.googleapis.com/v1/places/{placeId}/photos/{photoRef}/media
-- so we embed place_id into the proxy URL.
UPDATE public.places
SET photo_url = '/api/place-photo?ref='
  || SUBSTRING(photo_url FROM 'ref=([^&]+)')
  || '&w=800&place_id='
  || google_place_id
WHERE photo_url LIKE '/api/place-photo?ref=AU\_%'
  AND google_place_id IS NOT NULL;
