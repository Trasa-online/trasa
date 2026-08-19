-- Redesign profilu (07/08): footer kart list pokazuje zapisania + polubienia + wyswietlenia.
-- discovery_collections ma juz views_count/saves_count/plan_adds_count (denormalizowane liczniki).
-- Dokladamy likes_count w tym samym wzorcu, zeby karta listy miala metryke polubien symetrycznie
-- do tras (tabela `likes`). Bez flow lajkowania listy jeszcze - kolumna startuje z 0 i moze
-- rosnac gdy dodamy przycisk polubienia listy w widoku publicznym.
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
