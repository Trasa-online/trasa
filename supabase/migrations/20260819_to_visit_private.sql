-- Prywatne wishlisty "Do zobaczenia": to_visit -> is_public=false (RLS owner-read czyni je
-- widocznymi TYLKO dla właściciela). Rozdzielenie intencji: visited = publiczna polecajka
-- (moderowana), to_visit = prywatny schowek "chcę odwiedzić".
-- UWAGA: NIE zmieniamy moderation_status - trigger guard_discovery_moderation() blokuje to dla
-- nie-adminów (P0001). is_public=false wystarcza, a kolejka moderacji i tak filtruje list_status='visited'.
-- Idempotentne. Brak zmian kolumn/RLS.

UPDATE public.discovery_collections
  SET is_public = false
  WHERE kind = 'ranking'
    AND list_status = 'to_visit'
    AND is_public IS DISTINCT FROM false;
