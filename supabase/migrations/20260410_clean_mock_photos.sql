-- Remove picsum.photos placeholder URLs from the places table.
-- These were added by the mock data generator and are not real place photos.
-- After running this, use the Admin → Zdjęcia panel to re-populate via Google Places.

UPDATE public.places
SET photo_url = NULL
WHERE photo_url ILIKE '%picsum.photos%'
   OR photo_url ILIKE '%picsum.%'
   OR photo_url ILIKE '%lorem.%';

-- Show how many places still have no photo (informational)
SELECT city, COUNT(*) AS places_without_photo
FROM public.places
WHERE is_active = true
  AND (photo_url IS NULL OR photo_url = '')
GROUP BY city
ORDER BY places_without_photo DESC;
