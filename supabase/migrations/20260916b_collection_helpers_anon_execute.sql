-- REGRESJA: anon nie mogl czytac ZADNEJ kolekcji (2026-09-16).
--
--   GET /rest/v1/discovery_collections  ->  42501 "permission denied for function is_collection_member"
--   GET /rest/v1/discovery_items        ->  to samo
--
-- Skad: migracja 20260915c dolozyla polityki SELECT wolajace `is_collection_member(...)`
-- i w tej samej migracji odebrala tej funkcji EXECUTE dla `anon` (regula z audytu: SECDEF
-- domyslnie dostaje EXECUTE dla PUBLIC, wiec odbieramy). Jedno z drugim sie wyklucza.
--
-- ⚠️ NAUKA: funkcja uzyta W POLITYCE RLS musi byc wykonywalna przez KAZDA role, ktora czyta
-- te tabele. Nie ratuje tego nawet warunek `auth.uid() IS NOT NULL AND ...` postawiony przed
-- wywolaniem: Postgres sprawdza prawo do funkcji niezaleznie od tego, czy galaz sie wykona,
-- wiec dla anona cale zapytanie konczy sie bledem - nie pusta lista, tylko 42501.
--
-- Co bylo zepsute od 15.09 dla NIEZALOGOWANYCH:
--   * strona linku do kolekcji (`/l/<id>`, api/share.ts czyta kluczem anonimowym) - kazdy
--     udostepniony link pokazywal "Tresc niedostepna" zamiast kolekcji (zgloszenie Nat),
--   * talia okladek na ekranie powitalnym (`WelcomeDeck` czyta publiczne kolekcje PRZED
--     zalogowaniem),
--   * kazde inne wejscie w kolekcje bez sesji.
--
-- Co to ujawnia: nic ponad stan po migracji 20260915k. Obie funkcje oddaja sam BOOLEAN dla
-- podanej pary (kolekcja, user), a sklad publicznej kolekcji jest juz jawny. Dla anona
-- `auth.uid()` jest NULL, wiec i tak zawsze wychodzi false.

GRANT EXECUTE ON FUNCTION public.is_collection_member(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_collection_owner(uuid, uuid) TO anon;
