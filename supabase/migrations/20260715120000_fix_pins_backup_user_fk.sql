-- Fix: usuwanie konta usera (auth.users) wywalalo sie na tabeli pins_backup.
--
-- Dwie przyczyny:
--  1) FK pins_backup.user_id -> auth.users mial ON DELETE SET NULL, ale kolumna
--     user_id jest NOT NULL. Przy kasowaniu usera Postgres probowal ustawic NULL
--     na jego istniejacych backupach -> "null value violates not-null constraint".
--  2) Trigger backup_pin_before_delete wstawial backup z NULL user_id, gdy trasa
--     byla usuwana kaskadowo (route.user_id juz niedostepny w tym momencie).
--
-- Empirycznie podczas kaskady kasowania konta trigger dostaje v_user_id = NULL
-- (trasa znika przed pinami), wiec guard "pomin gdy NULL" wystarcza; a FK -> CASCADE
-- sprzata istniejace backupy razem z userem.

-- 1) Guard w triggerze: nie backupuj osieroconego pinu (cascade delete trasy/konta).
CREATE OR REPLACE FUNCTION public.backup_pin_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_route_title TEXT;
BEGIN
  SELECT r.user_id, r.title INTO v_user_id, v_route_title
  FROM routes r
  WHERE r.id = OLD.route_id;

  -- Trasa jest usuwana kaskadowo (np. przy kasowaniu konta) -> nie znamy wlasciciela.
  -- Backup osieroconego pinu nie ma sensu; pomijamy zamiast wstawiac NULL user_id.
  IF v_user_id IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO pins_backup (
    original_pin_id,
    route_id,
    user_id,
    place_name,
    address,
    description,
    image_url,
    images,
    rating,
    pin_order,
    tags,
    latitude,
    longitude,
    is_transport,
    transport_type,
    transport_end,
    mentioned_users,
    name_translations,
    original_creator_id,
    original_created_at,
    route_title,
    deletion_source
  ) VALUES (
    OLD.id,
    OLD.route_id,
    v_user_id,
    OLD.place_name,
    OLD.address,
    OLD.description,
    OLD.image_url,
    OLD.images,
    OLD.rating,
    OLD.pin_order,
    OLD.tags,
    OLD.latitude,
    OLD.longitude,
    OLD.is_transport,
    OLD.transport_type,
    OLD.transport_end,
    OLD.mentioned_users,
    OLD.name_translations,
    OLD.original_creator_id,
    OLD.created_at,
    v_route_title,
    COALESCE(current_setting('app.deletion_source', true), 'unknown')
  );

  RETURN OLD;
END;
$$;

-- 2) Usun osierocone backupy (user_id wskazuje na juz nieistniejacego usera).
--    To pozostalosc po wczesniejszych nieudanych kasowaniach kont. Musza zniknac
--    zanim dodamy FK z walidacja, inaczej ADD CONSTRAINT odrzuci istniejace wiersze.
DELETE FROM public.pins_backup pb
WHERE pb.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pb.user_id);

-- 3) FK pins_backup.user_id: SET NULL (na NOT NULL) -> CASCADE.
--    Constraint zostal nadany automatycznie (poza migracjami), wiec znajdz go po kolumnie.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.pins_backup'::regclass
    AND con.contype = 'f'
    AND att.attname = 'user_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pins_backup DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.pins_backup
    ADD CONSTRAINT pins_backup_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
END $$;
