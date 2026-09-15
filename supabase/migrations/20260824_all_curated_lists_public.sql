-- Decyzja 2026-08-24 (Nat): wszystkie kuratorskie listy (list_status='visited') muszą być PUBLICZNE
-- - usunięta opcja "prywatna" w UI/kodzie (rozwój bazy discovery). Prywatna zostaje TYLKO wishlista
-- "Do zobaczenia" (list_status='to_visit', is_public=false) - to nie jest kuratorska lista.
-- Backfill istniejących prywatnych polecajek -> publiczne + do kolejki moderacji (pending); listy
-- odrzucone (rejected) zostają bez zmian (i tak ukryte).
UPDATE public.discovery_collections
SET is_public = true,
    moderation_status = 'pending',
    updated_at = now()
WHERE kind = 'ranking'
  AND list_status = 'visited'
  AND is_public = false
  AND moderation_status IS DISTINCT FROM 'rejected';
