-- Wspoltworcy PUBLICZNEJ kolekcji sa widoczni dla ogladajacych (prosba Nat 2026-09-15:
-- "na profilach publicznych nie widac, ze inny user jest wspoltworca kolekcji").
--
-- Dotychczasowa polityka `dcm_read` (migracja 20260915c) wpuszczala WYLACZNIE wlasciciela,
-- czlonka i wiersz samego siebie. Konsekwencja byla szersza, niz wygladalo: gosc nie widzial
-- wspoltworcow ANI na kafelku kolekcji, ANI w gornej belce jej widoku - klient po prostu
-- dostawal pusta liste, bez bledu. Nie dalo sie tego naprawic po stronie UI.
--
-- Czy to ujawnia cos nowego: NIE. Kolekcja publiczna i tak pokazuje kazdemu notki i zdjecia
-- wspoltworcow Z IMIENIEM I AWATAREM (`discovery_item_notes` / `discovery_item_photos` maja
-- read po `can_read_collection`). Sam sklad byl wiec jedyna rzecza ukryta, choc jej efekty
-- byly widoczne - a wspolautorstwo publicznej kolekcji to zasluga, nie dane wrazliwe.
--
-- Zakres ZOSTAJE waski: `can_read_collection` przepuszcza kolekcje publiczna i niezablokowana
-- ALBO taka, do ktorej patrzacy i tak ma dostep. Sklad kolekcji PRYWATNEJ (w tym „Ogolne")
-- pozostaje niewidoczny dla obcych.

DROP POLICY IF EXISTS dcm_read ON public.discovery_collection_members;
CREATE POLICY dcm_read ON public.discovery_collection_members FOR SELECT
  USING (public.can_read_collection(collection_id, auth.uid()));
