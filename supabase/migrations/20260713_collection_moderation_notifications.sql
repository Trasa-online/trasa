-- Powiadomienia o moderacji zestawien (discovery_collections):
--  * akcept      -> notification_type 'collection_approved'
--  * odrzucenie  -> notification_type 'collection_rejected'
--
-- Kanal IN-APP: wpis w public.notifications tworzony przez SECURITY DEFINER trigger.
--   Admin robi UPDATE moderation_status z klienta, a RLS na notifications pozwala insertowac
--   tylko wiersze wlasne (auth.uid() = user_id) - odbiorca (autor zestawienia) to ktos inny,
--   wiec insert musi isc server-side (definer), nie z klienta admina.
-- Kanal PUSH: wysylany Z KLIENTA (Admin.tsx -> sendClientPush). send-push odrzuca pg_net z
--   anon-key (401 - patrz src/lib/clientPush.ts), a service-role key nie hardcodujemy w migracji.
--
-- Uwaga PG: ALTER TYPE ADD VALUE + uzycie wartosci w CIELE funkcji jest bezpieczne
-- (literal '...'::notification_type rozwiazywany w runtime, nie przy CREATE FUNCTION).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'collection_approved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'collection_rejected';

CREATE OR REPLACE FUNCTION public.notify_collection_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type public.notification_type;
BEGIN
  -- Tylko realna zmiana statusu na approved/rejected (ignoruj UPDATE np. hidden_by_admin/tytul).
  IF NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;
  IF NEW.moderation_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_type := (CASE WHEN NEW.moderation_status = 'approved'
                  THEN 'collection_approved' ELSE 'collection_rejected' END)::public.notification_type;

  -- Odbiorca = autor zestawienia. Brak realnego aktora-usera dla akcji moderatora, wiec
  -- actor_id = autor (kolumna NOT NULL); etykieta w NotificationsDrawer nie uzywa aktora,
  -- tylko metadata (tytul + ewentualny powod odrzucenia).
  INSERT INTO public.notifications (user_id, type, actor_id, metadata)
  VALUES (
    NEW.user_id,
    v_type,
    NEW.user_id,
    jsonb_build_object(
      'collection_id',   NEW.id,
      'title',           NEW.title,
      'moderation_note', NEW.moderation_note
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_collection_moderation ON public.discovery_collections;
CREATE TRIGGER trigger_collection_moderation
  AFTER UPDATE OF moderation_status ON public.discovery_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_collection_moderation();
