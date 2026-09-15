-- C4: powiadomienie o polubieniu zdjecia w galerii. Gdy user polubi zdjecie ktore ktos wgral
-- (place_photos, photo_ref = photo_url), autor dostaje powiadomienie typu 'photo_like'.
-- Trigger + SECURITY DEFINER (RLS-safe, jak inne powiadomienia). Lajki zdjec Google/B2B nie maja
-- autora w place_photos -> brak powiadomienia (tylko zdjecia userow).

-- 1. Nowy typ powiadomienia (osobny statement - wartosc enuma uzywana dopiero runtime).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'photo_like';

-- 2. Funkcja + trigger (aplikowane osobnym zapytaniem po commicie ALTER TYPE).
CREATE OR REPLACE FUNCTION public.notify_photo_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_place  text;
BEGIN
  SELECT user_id, place_name INTO v_author, v_place
  FROM public.place_photos
  WHERE photo_url = NEW.photo_ref
  LIMIT 1;

  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, read, metadata)
    VALUES (
      v_author, 'photo_like', NEW.user_id, false,
      jsonb_build_object('photo_ref', NEW.photo_ref, 'place_name', coalesce(v_place, ''))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_photo_like ON public.photo_likes;
CREATE TRIGGER trg_notify_photo_like
  AFTER INSERT ON public.photo_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_photo_like();
