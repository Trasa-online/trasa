-- Kategoria listy: odwiedzone (visited) vs do odwiedzenia (to_visit).
-- Zapis miejsca ze swipera/trasy/wizytówki trafia do listy jednej z tych kategorii.
-- Istniejące polecajki (kind=ranking) = miejsca które autor zna -> 'visited'.
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS list_status text NOT NULL DEFAULT 'to_visit'
  CHECK (list_status IN ('visited','to_visit'));

UPDATE public.discovery_collections
  SET list_status = 'visited'
  WHERE kind = 'ranking' AND list_status = 'to_visit' AND created_at < now();
