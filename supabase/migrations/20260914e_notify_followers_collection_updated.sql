-- "Ktos, kogo obserwujesz, dodal miejsce do swojej kolekcji" (prosba Nat 2026-09-14).
--
-- Do tej pory `notify_collection_updated` powiadamial WYLACZNIE tych, ktorzy kolekcje
-- ZAPISALI (saved_collections). Obserwowanie autora nie dawalo nic - a wyjazdy mialy to od
-- dawna (`notify_followers_on_new_route` -> new_route / route_updated). Dziura widoczna dla
-- usera: obserwuje kogos, ten dosypuje miejsca do swojej kolekcji i nikt sie o tym nie
-- dowiaduje, dopoki sam nie wejdzie na jego profil.
--
-- Teraz odbiorcy = ZAPISUJACY ∪ OBSERWUJACY (UNION, wiec kto i obserwuje, i ma zapisane,
-- dostaje JEDNO powiadomienie).
--
-- ⛔ Obserwujacy tylko dla kolekcji PUBLICZNEJ, niezablokowanej i nieodrzuconej. Bez tego
-- prywatna lista "Ogolne" (is_public=false, kazde "Zapisz" dosypuje do niej miejsce)
-- rozeslalaby obserwujacym informacje o prywatnych zapisach wlasciciela. Zapisujacy zostaja
-- bez tego warunku - zapisac da sie tylko kolekcje publiczna, a gdyby autor ja potem schowal,
-- to ci ludzie i tak ja maja u siebie.
--
-- Dedup bez zmian: max 1 "list_updated" na (odbiorca, kolekcja) na 5 minut, wiec dosypanie
-- dziesieciu miejsc pod rzad = jedno powiadomienie, nie dziesiec pushy.
-- Typ `list_updated` jest juz na bialej liscie `notify_push`, wiec push idzie automatycznie.

CREATE OR REPLACE FUNCTION public.notify_collection_updated(p_collection_id uuid, p_added integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid; v_title text; v_public boolean; v_uid uuid;
BEGIN
  SELECT c.user_id, c.title,
         (c.is_public AND NOT COALESCE(c.hidden_by_admin, false)
          AND COALESCE(c.moderation_status, 'approved') <> 'rejected')
    INTO v_owner, v_title, v_public
  FROM public.discovery_collections c WHERE c.id = p_collection_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RETURN; END IF;  -- tylko autor kolekcji

  FOR v_uid IN
    SELECT sc.user_id
      FROM public.saved_collections sc
     WHERE sc.collection_id = p_collection_id AND sc.user_id <> v_owner
    UNION
    SELECT f.follower_id
      FROM public.followers f
     WHERE v_public AND f.following_id = v_owner AND f.follower_id <> v_owner
  LOOP
    IF EXISTS (SELECT 1 FROM public.notifications
               WHERE user_id = v_uid
                 AND type = 'list_updated'::public.notification_type
                 AND (metadata->>'collection_id') = p_collection_id::text
                 AND created_at > now() - interval '5 minutes') THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, type, actor_id, metadata)
    VALUES (v_uid, 'list_updated'::public.notification_type, v_owner,
            jsonb_build_object('collection_id', p_collection_id::text,
                               'title', COALESCE(v_title, ''), 'added', p_added));
  END LOOP;
END; $function$;
