-- Tresc pusha dla trip_reminder liczona z metadanych kompletnosci (2026-08-30, prosba Nat).
-- Priorytet komunikatu: ZDJECIA -> notki -> publikacja; deep-link zalezy od etapu wyjazdu.
-- UWAGA: definicja wzieta z ZYWEJ funkcji na prodzie (pg_get_functiondef) i zmieniona TYLKO w
-- galezi trip_reminder - repo mialo starsza wersje (m.in. inny typ 'follower'), wiec nadpisanie
-- z pliku skasowaloby dzialajace galezie.
CREATE OR REPLACE FUNCTION public.notify_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
  DECLARE v_missing_photos INT; v_missing_notes INT; v_city TEXT;
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
    -- Tresc liczona z metadanych kompletnosci (enqueue_trip_reminders). ZDJECIA maja priorytet -
    -- to one buduja baze zdjec miejsc i okladki w eksploracji.
    v_missing_photos := COALESCE((NEW.metadata->>'missing_photos')::int, 0);
    v_missing_notes  := COALESCE((NEW.metadata->>'missing_notes')::int, 0);
    v_city := COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    IF v_missing_photos > 0 THEN
      v_title := 'Twój wyjazd czeka na zdjęcia 📸';
      v_body  := CASE
        WHEN v_missing_photos = 1 THEN 'Zostało jedno miejsce bez zdjęcia' || v_city || '. Dodaj je, zanim zapomnisz.'
        ELSE v_missing_photos || ' miejsc bez zdjęcia' || v_city || '. Dodaj je, zanim zapomnisz.'
      END;
    ELSIF v_missing_notes > 0 THEN
      v_title := 'Dokończ swój wyjazd ✍️';
      v_body  := CASE
        WHEN v_missing_notes = 1 THEN 'Zdjęcia masz komplet - została notka do jednego miejsca' || v_city || '.'
        ELSE 'Zdjęcia masz komplet - zostały notki do ' || v_missing_notes || ' miejsc' || v_city || '.'
      END;
    ELSE
      v_title := 'Wyjazd gotowy do publikacji 🎉';
      v_body  := 'Zdjęcia i notki masz komplet' || v_city || '. Opublikuj wyjazd, żeby pojawił się w eksploracji.';
    END IF;
    -- W trakcie -> widok wyjazdu (tam dodaje sie zdjecia przy miejscach). Roboczy -> stepper.
    v_url := CASE WHEN COALESCE(NEW.metadata->>'stage', 'draft') = 'ongoing'
                  THEN '/route/' || COALESCE(NEW.route_id::text, '')
                  ELSE '/review-summary?route=' || COALESCE(NEW.route_id::text, '') || '&edit=1' END;
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
$function$

