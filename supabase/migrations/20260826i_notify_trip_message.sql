-- Powiadomienia czatu (2026-08-26): nowa wiadomosc -> powiadomienie (in-app + push) do WSZYSTKICH
-- uczestnikow poza autorem, z info kto i w jakim wyjezdzie. Throttle 2 min (zywa rozmowa != spam).

CREATE OR REPLACE FUNCTION public.notify_trip_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_session uuid; v_city text; v_title text; v_uid uuid;
BEGIN
  SELECT user_id, group_session_id, city, title INTO v_owner, v_session, v_city, v_title
    FROM public.routes WHERE id = NEW.route_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;
  FOR v_uid IN
    SELECT DISTINCT uid FROM (
      SELECT v_owner AS uid
      UNION
      SELECT m.user_id FROM public.group_session_members m WHERE m.session_id = v_session
    ) x WHERE uid IS NOT NULL AND uid <> NEW.user_id
  LOOP
    -- Throttle: max 1 powiadomienie czatu na trase+usera na 2 min.
    IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_uid
               AND type = 'trip_message'::public.notification_type AND route_id = NEW.route_id
               AND created_at > now() - interval '2 minutes') THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, type, actor_id, route_id, metadata)
    VALUES (v_uid, 'trip_message'::public.notification_type, NEW.user_id, NEW.route_id,
            jsonb_build_object('city', COALESCE(v_city, ''), 'title', COALESCE(v_title, '')));
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_trip_message ON public.trip_messages;
CREATE TRIGGER trg_notify_trip_message AFTER INSERT ON public.trip_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_message();

-- notify_push: dokladamy trip_message (gate + galaz). Reszta 1:1 z 20260826c.
CREATE OR REPLACE FUNCTION public.notify_push()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used',
                      'route_invite','route_liked','list_liked','list_saved','trip_reminder','follower',
                      'trip_places_reminder','trip_message') THEN
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
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');
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
  ELSIF NEW.type = 'trip_places_reminder' THEN
    v_title := 'Dodaj miejsca do wyjazdu 📍';
    v_body  := v_actor_name || ' czeka na Twoje propozycje miejsc' || COALESCE(' na wyjazd po ' || initcap(NEW.metadata->>'city'), '');
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');
  ELSIF NEW.type = 'trip_message' THEN
    v_title := 'Nowa wiadomość 💬';
    v_body  := v_actor_name || ' napisał(a)' || COALESCE(' w „' || (NEW.metadata->>'title') || '"',
                 CASE WHEN COALESCE(NEW.metadata->>'city','') <> '' THEN ' w wyjeździe po ' || initcap(NEW.metadata->>'city') ELSE '' END);
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');
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
