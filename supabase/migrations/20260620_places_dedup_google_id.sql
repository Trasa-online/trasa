-- P0.1: kanoniczna tozsamosc miejsca = google_place_id.
-- Bez tego promote-to-lead i aktywacja tworza duplikaty tego samego lokalu, a analityka
-- (dodania do trasy, CTR) rozjezdza sie na 2+ rekordy = liczba pokazywana firmie klamie.

-- 1. Zwolnij google_place_id z NIE-kanonicznych duplikatow (zachowaj ten z wizytowka,
--    inaczej najstarszy). NIE usuwamy wierszy places (brak utraty danych) - tylko zdejmujemy
--    google_place_id z duplikatow, zeby partial unique index mogl powstac.
WITH ranked AS (
  SELECT p.id,
         ROW_NUMBER() OVER (
           PARTITION BY p.google_place_id
           ORDER BY (EXISTS (SELECT 1 FROM public.business_profiles bp WHERE bp.place_id = p.id)) DESC,
                    p.created_at ASC
         ) AS rn
  FROM public.places p
  WHERE p.google_place_id IS NOT NULL
)
UPDATE public.places SET google_place_id = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Jeden lokal = jeden wiersz po google_place_id.
CREATE UNIQUE INDEX IF NOT EXISTS places_google_place_id_unique
  ON public.places (google_place_id) WHERE google_place_id IS NOT NULL;
