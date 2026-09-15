-- Zapisane listy (bookmark cudzej listy) PRZENIESIONE z localStorage do DB (jak saved_routes),
-- zeby: (a) powiadomic zapisujacych gdy autor doda nowe miejsce, (b) chip "Nowe miejsce!" na karcie.
-- seen_item_count = liczba miejsc w chwili ostatniego obejrzenia (chip = current_count > seen_count).

CREATE TABLE IF NOT EXISTS public.saved_collections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.discovery_collections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_item_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, collection_id)
);
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved collections" ON public.saved_collections;
CREATE POLICY "own saved collections" ON public.saved_collections FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS saved_collections_collection_idx ON public.saved_collections(collection_id);

-- Autor dodal miejsca do listy -> powiadom (in-app) WSZYSTKICH ktorzy zapisali, poza autorem.
-- SECURITY DEFINER (klient nie ma INSERT na notifications). Tylko wlasciciel listy moze wywolac.
CREATE OR REPLACE FUNCTION public.notify_collection_updated(p_collection_id uuid, p_added int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_title text; v_uid uuid;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM public.discovery_collections WHERE id = p_collection_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RETURN; END IF;  -- tylko autor listy
  FOR v_uid IN SELECT user_id FROM public.saved_collections WHERE collection_id = p_collection_id AND user_id <> v_owner
  LOOP
    -- Dedup: max 1 "list_updated" na (odbiorca, lista) na 5 min (seria dodan != seria pushy/notyfow).
    IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_uid
               AND type = 'list_updated'::public.notification_type
               AND (metadata->>'collection_id') = p_collection_id::text
               AND created_at > now() - interval '5 minutes') THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, type, actor_id, metadata)
    VALUES (v_uid, 'list_updated'::public.notification_type, v_owner,
            jsonb_build_object('collection_id', p_collection_id::text, 'title', COALESCE(v_title, ''), 'added', p_added));
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_collection_updated(uuid, int) TO authenticated;
