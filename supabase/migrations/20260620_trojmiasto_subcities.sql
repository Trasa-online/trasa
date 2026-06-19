-- Normalizacja sub-miast Trójmiasta. Wczesniej Gdynia i Sopot mialy oba city='Trójmiasto'
-- (Gdańsk juz mial city='Gdańsk'). Po tym kazde miejsce ma realne sub-miasto, a "Trójmiasto"
-- staje sie meta-wyborem UI rozwijanym przez expandCity() -> [Gdańsk, Gdynia, Sopot].
--
-- Rozpoznanie: Gdynia ma address='Gdynia' (migracja 20260417_places_trojmiasto_gdynia.sql);
-- Sopot ma address=NULL (migracja 20260417_sopot_places.sql). Reszta 'Trójmiasto' = Sopot.
-- Idempotentne: po pierwszym uruchomieniu nie ma juz city='Trójmiasto'.

UPDATE public.places SET city = 'Gdynia'
  WHERE city = 'Trójmiasto' AND address ILIKE '%Gdynia%';

UPDATE public.places SET city = 'Sopot'
  WHERE city = 'Trójmiasto';
