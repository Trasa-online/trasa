-- Polubienia tras/list + powiadomienia (polubienie + zapis). 2026-08-20.
-- notification_type: dodane 'route_liked','list_liked','list_saved' (osobno, przed tą migracją).
-- Insert notyfikacji tylko przez SECURITY DEFINER (tabela notifications nie ma polityki INSERT).

-- likes_count na wypadek braku (idempotentnie)
ALTER TABLE public.discovery_collections ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- ── Polubienia TRAS (per-user) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes public read" ON public.likes;
CREATE POLICY "likes public read" ON public.likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes own insert" ON public.likes;
CREATE POLICY "likes own insert" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes own delete" ON public.likes;
CREATE POLICY "likes own delete" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- ── Polubienia LIST (per-user) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collection_likes (
  collection_id uuid NOT NULL REFERENCES public.discovery_collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, user_id)
);
ALTER TABLE public.collection_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collection_likes public read" ON public.collection_likes;
CREATE POLICY "collection_likes public read" ON public.collection_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "collection_likes own insert" ON public.collection_likes;
CREATE POLICY "collection_likes own insert" ON public.collection_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "collection_likes own delete" ON public.collection_likes;
CREATE POLICY "collection_likes own delete" ON public.collection_likes FOR DELETE USING (auth.uid() = user_id);

-- likes_count listy w sync z collection_likes
CREATE OR REPLACE FUNCTION public.collection_likes_count_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discovery_collections SET likes_count = COALESCE(likes_count,0) + 1 WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discovery_collections SET likes_count = GREATEST(COALESCE(likes_count,0) - 1, 0) WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_collection_likes_count ON public.collection_likes;
CREATE TRIGGER trg_collection_likes_count AFTER INSERT OR DELETE ON public.collection_likes FOR EACH ROW EXECUTE FUNCTION public.collection_likes_count_sync();

-- ── Powiadomienia ─────────────────────────────────────────────────────────────
-- Polubienie TRASY -> owner
CREATE OR REPLACE FUNCTION public.notify_route_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_city text;
BEGIN
  SELECT user_id, city INTO v_owner, v_city FROM public.routes WHERE id = NEW.route_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, route_id, metadata)
  VALUES (v_owner, 'route_liked'::public.notification_type, NEW.user_id, NEW.route_id, jsonb_build_object('city', COALESCE(v_city,'')));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_route_like ON public.likes;
CREATE TRIGGER trg_notify_route_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_route_like();

-- Polubienie LISTY -> owner
CREATE OR REPLACE FUNCTION public.notify_list_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM public.discovery_collections WHERE id = NEW.collection_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, metadata)
  VALUES (v_owner, 'list_liked'::public.notification_type, NEW.user_id, jsonb_build_object('title', COALESCE(v_title,''), 'collection_id', NEW.collection_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_list_like ON public.collection_likes;
CREATE TRIGGER trg_notify_list_like AFTER INSERT ON public.collection_likes FOR EACH ROW EXECUTE FUNCTION public.notify_list_like();

-- Zapis LISTY -> owner (RPC wołany z klienta przy zapisie)
CREATE OR REPLACE FUNCTION public.notify_collection_saved(p_collection_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); v_owner uuid; v_title text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT user_id, title INTO v_owner, v_title FROM public.discovery_collections WHERE id = p_collection_id;
  IF v_owner IS NULL OR v_owner = me THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, metadata)
  VALUES (v_owner, 'list_saved'::public.notification_type, me, jsonb_build_object('title', COALESCE(v_title,''), 'collection_id', p_collection_id));
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_collection_saved(uuid) TO authenticated;
