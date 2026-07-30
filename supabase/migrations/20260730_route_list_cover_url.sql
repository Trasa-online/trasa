-- Miniatura eksploracji jako OSOBNA okladka od okladki trasy (2026-07-30).
-- routes.cover_url        = okladka trasy (hero w widoku trasy)
-- routes.list_cover_url   = miniatura na karcie trasy w eksploracji (podglad)
-- Obie ustawiane oddzielnie; miniatura jest auto-losowana ze zdjec usera przy
-- finalizacji (klient) i sluzy jako BRAMKA: trasa pojawia sie w eksploracji tylko
-- gdy list_cover_url != NULL ("sfinalizowana" = ma ustawiona miniature).

ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS list_cover_url text;

-- Backfill istniejacych udostepnionych tras, zeby nie zniknely z eksploracji:
-- miniatura = okladka trasy -> pierwsze zdjecie usera z galerii -> zdjecie usera z pinow.
-- Trasy bez zadnego zdjecia usera zostaja NULL (poprawnie ukryte do czasu dodania zdjecia).
UPDATE public.routes r
SET list_cover_url = COALESCE(
  r.cover_url,
  r.review_photos[1],
  (SELECT p.images[1] FROM public.pins p
     WHERE p.route_id = r.id AND p.images IS NOT NULL AND array_length(p.images, 1) >= 1
     ORDER BY p.pin_order LIMIT 1),
  (SELECT p.user_photo_urls[1] FROM public.pins p
     WHERE p.route_id = r.id AND p.user_photo_urls IS NOT NULL AND array_length(p.user_photo_urls, 1) >= 1
     ORDER BY p.pin_order LIMIT 1)
)
WHERE r.is_shared = true AND r.list_cover_url IS NULL;

-- Indeks pod bramke eksploracji (filtr is_shared + list_cover_url NOT NULL).
CREATE INDEX IF NOT EXISTS idx_routes_shared_list_cover
  ON public.routes (city)
  WHERE is_shared = true AND list_cover_url IS NOT NULL;
