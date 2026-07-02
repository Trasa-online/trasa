-- route_used (ktos uzyl/skopiowal Twoja trase z Eksploruj) + UJEDNOLICENIE kanalu push.
-- Wczesniej push lecial dwoma kanalami: trigger DB (trigger_group_invite_push / trigger_friend_push)
-- ORAZ helper kliencki sendGroupInvitePush -> podwojny push dla group_invite. Teraz JEDEN trigger
-- notify_push na notifications obsluguje wszystkie typy oparte o insert notyfikacji, a klient nie
-- wysyla juz pusha. group_route_ready ma wlasny push w triggerze na routes (pomijamy tu, by nie dublowac).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'route_used';

-- RPC: powiadom autora oryginalnej trasy, ze ktos ja skopiowal ("Uzyj tej trasy").
-- SECURITY DEFINER - klient nie moze insertowac notyfikacji dla innego usera (RLS).
CREATE OR REPLACE FUNCTION public.notify_route_used(p_route_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); v_owner uuid; v_city text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT user_id, city INTO v_owner, v_city FROM public.routes WHERE id = p_route_id;
  IF v_owner IS NULL OR v_owner = me THEN RETURN; END IF;  -- brak wlasciciela / wlasna trasa
  INSERT INTO public.notifications (user_id, type, actor_id, route_id, metadata)
  VALUES (v_owner, 'route_used'::public.notification_type, me, p_route_id,
          jsonb_build_object('city', COALESCE(v_city, '')));
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_route_used(uuid) TO authenticated;

-- ── JEDEN kanal push: trigger na notifications dla wszystkich typow z insertu notyfikacji ──
-- Push best-effort: blad pg_net (net.http_post) NIE moze cofnac insertu notyfikacji (BEGIN/EXCEPTION).
CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(first_name, username, 'Ktoś') INTO v_actor_name FROM public.profiles WHERE id = NEW.actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Ktoś');

  IF NEW.type = 'group_invite' THEN
    v_title := 'Zaproszenie do sesji 🗺️';
    v_body  := v_actor_name || ' zaprasza Cię do sesji' || COALESCE(' w ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/sesja/' || COALESCE(NEW.metadata->>'join_code', '');
  ELSIF NEW.type = 'friend_request' THEN
    v_title := 'Nowe zaproszenie do znajomych 👋';
    v_body  := v_actor_name || ' chce dodać Cię do znajomych';
    v_url   := '/moj-profil';
  ELSIF NEW.type = 'friend_accept' THEN
    v_title := 'Masz nowego znajomego 🎉';
    v_body  := v_actor_name || ' przyjął(a) Twoje zaproszenie';
    v_url   := '/moj-profil';
  ELSE -- route_used
    v_title := 'Ktoś korzysta z Twojej trasy 🧭';
    v_body  := v_actor_name || ' zapisał(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/dziennik';
  END IF;

  v_payload := jsonb_build_object('user_id', NEW.user_id, 'title', v_title, 'body', v_body, 'url', v_url)::text;

  BEGIN
    PERFORM extensions.net.http_post(
      url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/send-push',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU"}'::jsonb,
      body    := v_payload
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- push best-effort, nie blokuje notyfikacji
  END;

  RETURN NEW;
END;
$$;

-- Zastap poprzednie osobne triggery jednym (idempotentnie).
DROP TRIGGER IF EXISTS trigger_group_invite_push ON public.notifications;
DROP TRIGGER IF EXISTS trigger_friend_push ON public.notifications;
DROP TRIGGER IF EXISTS trigger_notification_push ON public.notifications;
CREATE TRIGGER trigger_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push();
