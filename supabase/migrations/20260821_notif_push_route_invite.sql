-- Powiadomienia (2026-08-21): (1) IN-APP dla zaproszenia do wspolnego wyjazdu (dzwonek, nie tylko
-- push), (2) PUSH dla polubien trasy/listy + zapisania listy (dzis tylko in-app).
-- Klient nie ma INSERT na notifications -> SECURITY DEFINER RPC/trigger. verify_jwt=false na
-- send-push, wiec push z triggera (pg_net anon) dziala.

-- Enum route_invite - APLIKOWANE OSOBNO (przed reszta) przez Management API:
--   ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'route_invite';
-- (ADD VALUE nie moze byc uzyty w tej samej transakcji co jego uzycie ponizej.)

-- ── RPC: powiadom zaproszonego, ze host dodal go do wspolnego wyjazdu (route_invite in-app) ──
CREATE OR REPLACE FUNCTION public.notify_route_invite(p_route_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); v_owner uuid; v_city text;
BEGIN
  IF me IS NULL OR p_user_id IS NULL OR p_user_id = me THEN RETURN; END IF;
  SELECT user_id, city INTO v_owner, v_city FROM public.routes WHERE id = p_route_id;
  IF v_owner IS NULL OR v_owner <> me THEN RETURN; END IF;  -- tylko host (wlasciciel trasy) zaprasza
  -- Dedup: nie duplikuj tego samego zaproszenia (np. przy ponownym otwarciu InviteFriendsSheet).
  IF EXISTS (SELECT 1 FROM public.notifications
             WHERE user_id = p_user_id AND type = 'route_invite'::public.notification_type AND route_id = p_route_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, route_id, metadata)
  VALUES (p_user_id, 'route_invite'::public.notification_type, me, p_route_id,
          jsonb_build_object('city', COALESCE(v_city, '')));
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_route_invite(uuid, uuid) TO authenticated;

-- ── Rozszerzony push: dokladamy route_invite + route_liked + list_liked + list_saved ──
CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used',
                      'route_invite','route_liked','list_liked','list_saved') THEN
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
  ELSE -- route_used
    v_title := 'Ktoś korzysta z Twojej trasy 🧭';
    v_body  := v_actor_name || ' zapisał(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/moj-profil?tab=wyjazdy';
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
