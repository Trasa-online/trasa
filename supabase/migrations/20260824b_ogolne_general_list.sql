-- Decyzja 2026-08-24 (Nat): lista "Ogólne" = JEDYNA prywatna lista każdego usera (to_visit),
-- dostępna od założenia konta, poza moderacją. Konsolidacja per-miasto to_visit -> JEDNA globalna
-- lista "Ogólne" (city=null, is_public=false). Naprawia też 3 to_visit błędnie is_public=true
-- (przeciek prywatnej wishlisty do eksploracji) -> prywatne. Uwaga: discovery_items NIE mają
-- ON DELETE CASCADE, więc itemy przenosimy/kasujemy ręcznie przed usunięciem kolekcji.
DO $$
BEGIN
  -- keeper = najstarsza to_visit per user
  CREATE TEMP TABLE _keep AS
    SELECT DISTINCT ON (user_id) user_id, id AS keeper_id
    FROM public.discovery_collections
    WHERE kind = 'ranking' AND list_status = 'to_visit'
    ORDER BY user_id, created_at ASC;

  -- przenieś itemy z pozostałych to_visit do keepera (dedup po nazwie miejsca)
  UPDATE public.discovery_items di
  SET collection_id = k.keeper_id
  FROM public.discovery_collections c, _keep k
  WHERE di.collection_id = c.id AND c.user_id = k.user_id
    AND c.kind = 'ranking' AND c.list_status = 'to_visit' AND c.id <> k.keeper_id
    AND NOT EXISTS (
      SELECT 1 FROM public.discovery_items d2
      WHERE d2.collection_id = k.keeper_id AND lower(d2.place_name) = lower(di.place_name)
    );

  -- usuń pozostałe (zduplikowane) itemy w non-keeper to_visit
  DELETE FROM public.discovery_items di
  USING public.discovery_collections c, _keep k
  WHERE di.collection_id = c.id AND c.user_id = k.user_id
    AND c.kind = 'ranking' AND c.list_status = 'to_visit' AND c.id <> k.keeper_id;

  -- usuń nadmiarowe kolekcje to_visit
  DELETE FROM public.discovery_collections c
  USING _keep k
  WHERE c.user_id = k.user_id AND c.kind = 'ranking' AND c.list_status = 'to_visit' AND c.id <> k.keeper_id;

  -- keeper -> "Ogólne", globalna (city=null), prywatna. Guard ustawi moderation='approved' przy
  -- zmianie is_public (public->private); dla już-prywatnych moderation zostaje bez zmian.
  UPDATE public.discovery_collections c
  SET title = 'Ogólne', city = NULL, is_public = false, updated_at = now()
  FROM _keep k WHERE c.id = k.keeper_id;

  DROP TABLE _keep;
END $$;
