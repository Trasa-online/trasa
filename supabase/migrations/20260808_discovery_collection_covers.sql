-- Okladki list miejsc (discovery_collections) - 1:1 z modelem tras (routes.cover_url +
-- routes.list_cover_url). Do tej pory lista NIE miala wlasnej okladki: hero w /lista/:id
-- i miniatura w feedzie eksploracji byly wyliczane ze zdjecia pierwszego miejsca. Teraz
-- user moze ustawic je recznie w kreatorze (CreateRanking krok 2).
--   cover_url       = okladka listy (hero na /lista/:id)
--   list_cover_url  = miniatura na karcie w eksploracji (feed)
-- Oba NULLABLE: gdy user nic nie wybierze, UI robi fallback do zdjecia miejsca (jak dotad).
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS list_cover_url text;
