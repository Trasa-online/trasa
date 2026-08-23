-- #6: routes.saves_count / likes_count (denormalizacja). Powod: RLS na saved_routes ogranicza
-- SELECT do wlasnych wierszy zapisujacego, wiec liczenie zapisow po stronie klienta zwraca 0 dla
-- WLASNEJ trasy (owner nie widzi cudzych zapisow) - liczniki na profilu byly puste. Kolumny
-- utrzymywane triggerami (jak discovery_collections.saves_count/likes_count) + backfill.
-- #1: push dla nowego obserwujacego (follower). In-app juz dziala (trigger on_follower_created ->
-- notify_on_follow wstawia notyfikacje 'follower'). Dodajemy tylko galaz w notify_push.

-- ── #6: liczniki na routes ──────────────────────────────────────────────────
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.route_saves_count_sync() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.routes SET saves_count = COALESCE(saves_count,0) + 1 WHERE id = NEW.route_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.routes SET saves_count = GREATEST(COALESCE(saves_count,0) - 1, 0) WHERE id = OLD.route_id;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_route_saves_count ON public.saved_routes;
CREATE TRIGGER trg_route_saves_count AFTER INSERT OR DELETE ON public.saved_routes
  FOR EACH ROW EXECUTE FUNCTION public.route_saves_count_sync();

CREATE OR REPLACE FUNCTION public.route_likes_count_sync() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.routes SET likes_count = COALESCE(likes_count,0) + 1 WHERE id = NEW.route_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.routes SET likes_count = GREATEST(COALESCE(likes_count,0) - 1, 0) WHERE id = OLD.route_id;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_route_likes_count ON public.likes;
CREATE TRIGGER trg_route_likes_count AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.route_likes_count_sync();

-- Backfill baseline z istniejacych rekordow (triggery juz zalozone -> kolejne zmiany utrzymuja).
UPDATE public.routes r SET saves_count = COALESCE((SELECT count(*) FROM public.saved_routes s WHERE s.route_id = r.id), 0);
UPDATE public.routes r SET likes_count = COALESCE((SELECT count(*) FROM public.likes l WHERE l.route_id = r.id), 0);

-- ── #1: push follower (galaz w notify_push + follower w allowliscie) ─────────
CREATE OR REPLACE FUNCTION public.notify_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used',
                      'route_invite','route_liked','list_liked','list_saved','trip_reminder','follower') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(first_name, username, 'Ktoś') INTO v_actor_name FROM public.profiles WHERE id = NEW.actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Ktoś');

  IF NEW.type = 'group_invite' THEN
    v_title := 'Zaproszenie do sesji 🗺️';
    v_body  := v_actor_name || ' zaprasza Cię do sesji' || COALESCE(' w ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/sesja/' || COALESCE(NEW.metadata->>'join_code', '');
  ELSIF NEW.type = 'route_invite' THEN
    v_title := 'Nowy wspólny wyjazd 🗺️';
    v_body  := v_actor_name || ' dodał(a) Cię do wspólnego wyjazdu' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/review-summary?route=' || COALESCE(NEW.route_id::text, '');
  ELSIF NEW.type = 'friend_request' THEN
    v_title := 'Nowe zaproszenie do znajomych 👋';
    v_body  := v_actor_name || ' chce dodać Cię do znajomych';
    v_url   := '/moj-profil';
  ELSIF NEW.type = 'friend_accept' THEN
    v_title := 'Masz nowego znajomego 🎉';
    v_body  := v_actor_name || ' przyjął(a) Twoje zaproszenie';
    v_url   := '/moj-profil';
  ELSIF NEW.type = 'follower' THEN
    v_title := 'Masz nowego obserwującego 👀';
    v_body  := v_actor_name || ' zaczął(a) Cię obserwować';
    v_url   := '/moj-profil';
  ELSIF NEW.type = 'route_liked' THEN
    v_title := 'Ktoś polubił Twoją trasę ❤️';
    v_body  := v_actor_name || ' polubił(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/review-summary?route=' || COALESCE(NEW.route_id::text, '');
  ELSIF NEW.type = 'list_liked' THEN
    v_title := 'Ktoś polubił Twoją listę ❤️';
    v_body  := v_actor_name || ' polubił(a) Twoją listę' || COALESCE(' „' || (NEW.metadata->>'title') || '"', '');
    v_url   := '/lista/' || COALESCE(NEW.metadata->>'collection_id', '');
  ELSIF NEW.type = 'list_saved' THEN
    v_title := 'Ktoś zapisał Twoją listę 🔖';
    v_body  := v_actor_name || ' zapisał(a) Twoją listę' || COALESCE(' „' || (NEW.metadata->>'title') || '"', '');
    v_url   := '/lista/' || COALESCE(NEW.metadata->>'collection_id', '');
  ELSIF NEW.type = 'trip_reminder' THEN
    v_title := 'Dokończ swój wyjazd 📸';
    v_body  := 'Dodaj zdjęcia i notki' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '') || ', żeby wyjazd pojawił się w eksploracji';
    v_url   := '/review-summary?route=' || COALESCE(NEW.route_id::text, '') || '&edit=1';
  ELSE -- route_used
    v_title := 'Ktoś korzysta z Twojej trasy 🧭';
    v_body  := v_actor_name || ' zapisał(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/moj-profil?tab=wyjazdy';
  END IF;

  v_payload := jsonb_build_object('user_id', NEW.user_id, 'title', v_title, 'body', v_body, 'url', v_url);

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;

  BEGIN
    PERFORM net.http_post(
      url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/send-push',
      body    := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU',
        'x-trigger-secret', COALESCE(v_secret, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;
