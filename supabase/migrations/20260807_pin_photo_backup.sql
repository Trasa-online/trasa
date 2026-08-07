-- Backup zdjec userow przypisanych do miejsc (pins.images / user_photo_urls / image_url /
-- photo_url) - ZRODLO zdjec miejsc w eksploracji. Chroni przed utrata przy delete pinow
-- (np. edycja trasy delete+reinsert). Lekcja z pins_backup (2026-08): trigger MUSI byc
-- exception-safe i NIGDY nie blokowac delete.

CREATE TABLE IF NOT EXISTS public.pin_photo_backup (
  route_id uuid NOT NULL,
  place_name text NOT NULL,
  place_id uuid,
  images text[],
  user_photo_urls text[],
  image_url text,
  photo_url text,
  original_pin_id uuid,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, place_name)   -- upsert: najnowszy backup per miejsce (bez rozrostu)
);

CREATE INDEX IF NOT EXISTS pin_photo_backup_place_id_idx ON public.pin_photo_backup (place_id);

-- Trigger BEFORE DELETE: kopiuj zdjecia usera do backupu (tylko gdy sa jakies zdjecia).
CREATE OR REPLACE FUNCTION public.backup_pin_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.images IS NOT NULL AND array_length(OLD.images, 1) > 0)
     OR (OLD.user_photo_urls IS NOT NULL AND array_length(OLD.user_photo_urls, 1) > 0)
     OR OLD.image_url IS NOT NULL OR OLD.photo_url IS NOT NULL THEN
    BEGIN
      INSERT INTO public.pin_photo_backup
        (route_id, place_name, place_id, images, user_photo_urls, image_url, photo_url, original_pin_id, backed_up_at)
      VALUES
        (OLD.route_id, OLD.place_name, OLD.place_id, OLD.images, OLD.user_photo_urls, OLD.image_url, OLD.photo_url, OLD.id, now())
      ON CONFLICT (route_id, place_name) DO UPDATE SET
        place_id = EXCLUDED.place_id,
        images = EXCLUDED.images,
        user_photo_urls = EXCLUDED.user_photo_urls,
        image_url = EXCLUDED.image_url,
        photo_url = EXCLUDED.photo_url,
        original_pin_id = EXCLUDED.original_pin_id,
        backed_up_at = now();
    EXCEPTION WHEN OTHERS THEN
      -- best-effort: NIGDY nie blokuj delete (bug pins_backup: trigger do dropnietej tabeli walil deletey)
      NULL;
    END;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS backup_pin_photos_before_delete ON public.pins;
CREATE TRIGGER backup_pin_photos_before_delete
  BEFORE DELETE ON public.pins
  FOR EACH ROW EXECUTE FUNCTION public.backup_pin_photos();

-- RLS: wlasciciel trasy czyta swoje backupy (do restore w kodzie/UI). Trigger (DEFINER) pisze bez RLS.
ALTER TABLE public.pin_photo_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner reads own pin photo backup" ON public.pin_photo_backup;
CREATE POLICY "owner reads own pin photo backup" ON public.pin_photo_backup
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = pin_photo_backup.route_id AND r.user_id = auth.uid()));
