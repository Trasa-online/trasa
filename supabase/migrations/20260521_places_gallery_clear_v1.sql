-- =============================================================================
-- Czyszczenie zdublowanych gallery_urls z v1 backfillu
-- =============================================================================
-- v1 wersja skryptu backfill-place-galleries.ts zapisywala photo[0..2] do gallery,
-- ale photo[0] juz lezy w places.photo_url (jako cover) - karuzela pokazywala
-- to samo zdjecie dwa razy. v2 (po tej migracji) skipuje photo[0] i zapisuje
-- tylko photo[1..N+1] do gallery z prefiksem `v2_`.
--
-- Migracja zeruje gallery_urls dla miejsc, ktore maja v1 dane (sciezki bez prefix v2_),
-- zeby przy nastepnym `npm run backfill:galleries` byly reprocessowane jako v2.
-- Stare pliki w Storage (gallery/{id}/0.jpg, 1.jpg, 2.jpg) NIE sa usuwane - sa orphans.
-- Mozna je posprzatac pozniej skryptem `delete-orphan-v1-galleries.ts` jesli zalezy
-- na miejscu w buckecie. Dla MVP zostaja.
-- =============================================================================

UPDATE public.places
SET gallery_urls = '{}'::TEXT[]
WHERE cardinality(gallery_urls) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(gallery_urls) AS u(url)
    WHERE url ~ '/gallery/[^/]+/v2_'
  );
