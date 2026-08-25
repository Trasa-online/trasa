-- Powiadomienie "dodaj miejsca do wyjazdu" (2026-08-26): host klika "Wybierz miejsca", a jesli
-- ktorys uczestnik nie dodal jeszcze zadnego miejsca -> moze wyslac mu przypomnienie. enum
-- 'trip_places_reminder' dodane osobno (migracja wczesniej). RPC host-only + galaz w notify_push (push).

-- RPC: host wysyla przypomnienie uczestnikowi (in-app + push przez trigger notify_push).
CREATE OR REPLACE FUNCTION public.notify_trip_places_reminder(p_route_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); v_owner uuid; v_city text; v_title text;
BEGIN
  IF me IS NULL OR p_user_id IS NULL OR p_user_id = me THEN RETURN; END IF;
  SELECT user_id, city, title INTO v_owner, v_city, v_title FROM public.routes WHERE id = p_route_id;
  IF v_owner IS NULL OR v_owner <> me THEN RETURN; END IF;  -- tylko host (wlasciciel trasy)
  -- Dedup: max 1 przypomnienie na godzine dla tej samej trasy (re-klik "Wybierz miejsca" nie spamuje).
  IF EXISTS (SELECT 1 FROM public.notifications
             WHERE user_id = p_user_id AND type = 'trip_places_reminder'::public.notification_type
               AND route_id = p_route_id AND created_at > now() - interval '1 hour') THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, route_id, metadata)
  VALUES (p_user_id, 'trip_places_reminder'::public.notification_type, me, p_route_id,
          jsonb_build_object('city', COALESCE(v_city, ''), 'title', COALESCE(v_title, '')));
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_trip_places_reminder(uuid, uuid) TO authenticated;

-- notify_push: dokladamy galaz + typ do allowlisty (reszta 1:1 z 20260828 - net.http_post + x-trigger-secret).
CREATE OR REPLACE FUNCTION public.notify_push()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used',
                      'route_invite','route_liked','list_liked','list_saved','trip_reminder','follower',
                      'trip_places_reminder') THEN
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
