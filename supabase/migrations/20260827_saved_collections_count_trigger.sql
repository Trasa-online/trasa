-- saves_count na discovery_collections = liczba wierszy saved_collections (ZRODLO PRAWDY).
-- Dotad increment-only (RPC increment_collection_saves, bez dekrementu przy odzapisaniu) -> licznik
-- sie rozjezdzal (odklikniecie pokazywalo "-1"). Teraz trigger utrzymuje licznik z saved_collections
-- (insert +1 / delete -1), a klient przestaje wolac increment_collection_saves. (fix Nat 2026-08-27)

CREATE OR REPLACE FUNCTION public.saved_collections_count_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discovery_collections SET saves_count = COALESCE(saves_count, 0) + 1 WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discovery_collections SET saves_count = GREATEST(0, COALESCE(saves_count, 0) - 1) WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_saved_collections_count ON public.saved_collections;
CREATE TRIGGER trg_saved_collections_count
  AFTER INSERT OR DELETE ON public.saved_collections
  FOR EACH ROW EXECUTE FUNCTION public.saved_collections_count_sync();

-- Backfill: skoryguj dryf - saves_count = faktyczna liczba zapisow w saved_collections.
UPDATE public.discovery_collections c
SET saves_count = COALESCE((SELECT count(*) FROM public.saved_collections s WHERE s.collection_id = c.id), 0);
