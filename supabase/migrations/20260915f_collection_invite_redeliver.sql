-- Zaproszenie do kolekcji: dedup ZAWEZONY do doby (2026-09-15).
--
-- Push dla zaproszen dziala od migracji 20260915c (typ `list_invite` na bialej liscie
-- `notify_push`, wlasna galaz z trescia, adres `/lista/<id>`), ale dedup byl WIECZNY:
-- "jedno zaproszenie do tej kolekcji na osobe, kiedykolwiek". W praktyce znaczylo to, ze
-- po usunieciu wspoltworcy i ponownym dodaniu NIE dostawal juz zadnego sygnalu - kolekcja
-- po cichu pojawiala sie w jego "Zapisane" i nikt mu o tym nie mowil.
--
-- Teraz dedup patrzy na OSTATNIA DOBE. Chroni to przed realnym spamem (kilka tapniec pod
-- rzad, powtorzone dodanie tej samej osoby przy zapisie kreatora), a ponowne zaproszenie
-- po dniu albo po wczesniejszym usunieciu dochodzi normalnie.

CREATE OR REPLACE FUNCTION public.notify_collection_invite(p_collection_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_title text;
BEGIN
  IF v_uid IS NULL OR p_user_id = v_uid THEN RETURN; END IF;
  SELECT c.title INTO v_title FROM public.discovery_collections c
   WHERE c.id = p_collection_id AND c.user_id = v_uid AND c.deleted_at IS NULL;
  IF v_title IS NULL THEN RETURN; END IF;          -- nie moja kolekcja = brak powiadomienia
  -- Dedup DOBOWY: chroni przed spamem przy powtorzonym dodaniu, ale nie blokuje ponownego
  -- zaproszenia po usunieciu wspoltworcy.
  IF EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id = p_user_id
                AND type = 'list_invite'::public.notification_type
                AND (metadata->>'collection_id') = p_collection_id::text
                AND created_at > now() - interval '24 hours') THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, metadata)
  VALUES (p_user_id, 'list_invite'::public.notification_type, v_uid,
          jsonb_build_object('collection_id', p_collection_id::text, 'title', COALESCE(v_title, '')));
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_collection_invite(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.notify_collection_invite(uuid, uuid) TO authenticated;
