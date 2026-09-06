-- Pushe po angielsku (prosba Nat 2026-09-06). Toasty in-app sa juz dwujezyczne, ale push
-- przychodzi przy ZAMKNIETEJ apce - buduje go baza, a baza nie miala skad wiedziec, jakim
-- jezykiem mowi odbiorca. Stad kolumna `profiles.language` + rozgalezienie w notify_push.
--
-- UWAGA dla kolejnych zmian: tresc notify_push modyfikuje sie z ZYWEJ definicji
-- (pg_get_functiondef), nie z wersji w repo - funkcja bywala latana bezposrednio na bazie.

alter table public.profiles add column if not exists language text;

-- Tylko jezyki, ktore apka faktycznie ma. Bez CHECK-a wpadlyby tu warianty regionalne
-- ("en-US", "pl-PL") i rozgalezienie po '= en' przestaloby dzialac.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_language_check') then
    alter table public.profiles add constraint profiles_language_check
      check (language is null or language in ('pl','en'));
  end if;
end $$;

comment on column public.profiles.language is
  'Jezyk interfejsu wybrany/wykryty w apce (pl|en). Zrodlo prawdy dla tresci budowanych po
   stronie serwera: pushe (notify_push) i maile. NULL = nie wiemy, traktujemy jak polski.';

create or replace function public.notify_push()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
  DECLARE v_missing_photos INT; v_missing_notes INT; v_city TEXT; v_city_sfx TEXT; v_added INT;
  DECLARE v_en BOOLEAN; v_city_raw TEXT; v_title_meta TEXT;
BEGIN
  IF NEW.type NOT IN ('group_invite','friend_request','friend_accept','route_used',
                      'route_invite','route_liked','list_liked','list_saved','trip_reminder','follower',
                      'trip_places_reminder','trip_message','discovery_used','new_route','list_updated') THEN
    RETURN NEW;
  END IF;

  -- Jezyk ODBIORCY, nie autora. NULL (stare konta, nigdy nie wszedl w ustawienia) = polski.
  SELECT COALESCE(language, 'pl') = 'en' INTO v_en FROM public.profiles WHERE id = NEW.user_id;
  v_en := COALESCE(v_en, FALSE);

  SELECT COALESCE(first_name, username) INTO v_actor_name FROM public.profiles WHERE id = NEW.actor_id;
  v_actor_name := COALESCE(v_actor_name, CASE WHEN v_en THEN 'Someone' ELSE 'Ktoś' END);

  -- Miasto: z metadanych, a gdy ich brak (discovery_used ma puste metadata) - z samej trasy.
  v_city_raw := initcap(COALESCE(NEW.metadata->>'city',
                                 (SELECT r.city FROM public.routes r WHERE r.id = NEW.route_id)));
  -- Przyimek rozni sie miedzy jezykami ("trip TO Prague" vs "wyjazd PO Pradze"), wiec skladamy
  -- go raz, tutaj, zamiast doklejac ten sam ogonek w kazdej galezi.
  v_city_sfx := COALESCE(CASE WHEN v_en THEN ' to ' ELSE ' po ' END || v_city_raw, '');
  v_title_meta := NEW.metadata->>'title';

  IF NEW.type = 'group_invite' THEN
    IF v_en THEN
      v_title := 'Session invite 🗺️';
      v_body  := v_actor_name || ' is inviting you to a session' || COALESCE(' in ' || initcap(NEW.metadata->>'city'), '');
    ELSE
      v_title := 'Zaproszenie do sesji 🗺️';
      v_body  := v_actor_name || ' zaprasza Cię do sesji' || COALESCE(' w ' || initcap(NEW.metadata->>'city'), '');
    END IF;
    v_url   := '/sesja/' || COALESCE(NEW.metadata->>'join_code', '');

  ELSIF NEW.type = 'route_invite' THEN
    IF v_en THEN
      v_title := 'New shared trip 🗺️';
      v_body  := v_actor_name || ' added you to a shared trip' || COALESCE(' to ' || initcap(NEW.metadata->>'city'), '');
    ELSE
      v_title := 'Nowy wspólny wyjazd 🗺️';
      v_body  := v_actor_name || ' dodał(a) Cię do wspólnego wyjazdu' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    END IF;
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');

  ELSIF NEW.type = 'friend_request' THEN
    IF v_en THEN
      v_title := 'New friend request 👋';
      v_body  := v_actor_name || ' wants to add you as a friend';
    ELSE
      v_title := 'Nowe zaproszenie do znajomych 👋';
      v_body  := v_actor_name || ' chce dodać Cię do znajomych';
    END IF;
    v_url   := '/moj-profil';

  ELSIF NEW.type = 'friend_accept' THEN
    IF v_en THEN
      v_title := 'You have a new friend 🎉';
      v_body  := v_actor_name || ' accepted your request';
    ELSE
      v_title := 'Masz nowego znajomego 🎉';
      v_body  := v_actor_name || ' przyjął(a) Twoje zaproszenie';
    END IF;
    v_url   := '/moj-profil';

  ELSIF NEW.type = 'follower' THEN
    IF v_en THEN
      v_title := 'You have a new follower 👀';
      v_body  := v_actor_name || ' started following you';
    ELSE
      v_title := 'Masz nowego obserwującego 👀';
      v_body  := v_actor_name || ' zaczął(a) Cię obserwować';
    END IF;
    v_url   := '/moj-profil';

  ELSIF NEW.type = 'route_liked' THEN
    IF v_en THEN
      v_title := 'Someone liked your trip ❤️';
      v_body  := v_actor_name || ' liked your trip' || COALESCE(' to ' || initcap(NEW.metadata->>'city'), '');
    ELSE
      v_title := 'Ktoś polubił Twoją trasę ❤️';
      v_body  := v_actor_name || ' polubił(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    END IF;
    v_url   := '/review-summary?route=' || COALESCE(NEW.route_id::text, '');

  ELSIF NEW.type = 'list_liked' THEN
    IF v_en THEN
      v_title := 'Someone liked your list ❤️';
      v_body  := v_actor_name || ' liked your list' || COALESCE(' “' || v_title_meta || '”', '');
    ELSE
      v_title := 'Ktoś polubił Twoją listę ❤️';
      v_body  := v_actor_name || ' polubił(a) Twoją listę' || COALESCE(' „' || v_title_meta || '”', '');
    END IF;
    v_url   := '/lista/' || COALESCE(NEW.metadata->>'collection_id', '');

  ELSIF NEW.type = 'list_saved' THEN
    IF v_en THEN
      v_title := 'Someone saved your list 🔖';
      v_body  := v_actor_name || ' saved your list' || COALESCE(' “' || v_title_meta || '”', '');
    ELSE
      v_title := 'Ktoś zapisał Twoją listę 🔖';
      v_body  := v_actor_name || ' zapisał(a) Twoją listę' || COALESCE(' „' || v_title_meta || '”', '');
    END IF;
    v_url   := '/lista/' || COALESCE(NEW.metadata->>'collection_id', '');

  ELSIF NEW.type = 'discovery_used' THEN
    -- Ktos wzial moj plan do siebie. Najmocniejszy sygnal zwrotny dla autora.
    IF v_en THEN
      v_title := 'Someone is using your plan';
      v_body  := v_actor_name || ' used your plan' || v_city_sfx;
    ELSE
      v_title := 'Ktoś korzysta z Twojego planu';
      v_body  := v_actor_name || ' skorzystał(a) z Twojego planu' || v_city_sfx;
    END IF;
    v_url   := '/moj-profil?tab=wyjazdy';

  ELSIF NEW.type = 'new_route' THEN
    IF v_en THEN
      v_title := 'New trip';
      v_body  := v_actor_name || ' published a trip' || v_city_sfx;
    ELSE
      v_title := 'Nowy wyjazd';
      v_body  := v_actor_name || ' opublikował(a) wyjazd' || v_city_sfx;
    END IF;
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');

  ELSIF NEW.type = 'list_updated' THEN
    -- Liczbe dodanych miejsc niesie metadata.added; notify_collection_updated dedupuje do
    -- jednego powiadomienia na (odbiorca, lista) na 5 minut.
    v_added := GREATEST(COALESCE((NEW.metadata->>'added')::int, 1), 1);
    IF v_en THEN
      v_title := CASE WHEN v_added = 1 THEN 'New place on a saved list' ELSE 'New places on a saved list' END;
      v_body  := v_actor_name || CASE WHEN v_added = 1 THEN ' added a place' ELSE ' added ' || v_added || ' places' END
                 || COALESCE(' to “' || v_title_meta || '”', ' to your list');
    ELSE
      v_title := CASE WHEN v_added = 1 THEN 'Nowe miejsce na zapisanej liście' ELSE 'Nowe miejsca na zapisanej liście' END;
      v_body  := v_actor_name || CASE
                   WHEN v_added = 1 THEN ' dodał(a) miejsce'
                   WHEN v_added < 5  THEN ' dodał(a) ' || v_added || ' miejsca'
                   ELSE ' dodał(a) ' || v_added || ' miejsc'
                 END || COALESCE(' do „' || v_title_meta || '”', ' do Twojej listy');
    END IF;
    v_url   := '/lista/' || COALESCE(NEW.metadata->>'collection_id', '');

  ELSIF NEW.type = 'trip_reminder' THEN
    -- Tresc liczona z metadanych kompletnosci (enqueue_trip_reminders). ZDJECIA maja priorytet -
    -- to one buduja baze zdjec miejsc i okladki w eksploracji.
    v_missing_photos := COALESCE((NEW.metadata->>'missing_photos')::int, 0);
    v_missing_notes  := COALESCE((NEW.metadata->>'missing_notes')::int, 0);
    v_city := COALESCE(CASE WHEN v_en THEN ' to ' ELSE ' po ' END || initcap(NEW.metadata->>'city'), '');
    IF v_missing_photos > 0 THEN
      IF v_en THEN
        v_title := 'Your trip is waiting for photos 📸';
        v_body  := CASE
          WHEN v_missing_photos = 1 THEN 'One place on your trip' || v_city || ' still has no photo. Add it before you forget.'
          ELSE v_missing_photos || ' places on your trip' || v_city || ' still have no photo. Add them before you forget.'
        END;
      ELSE
        v_title := 'Twój wyjazd czeka na zdjęcia 📸';
        v_body  := CASE
          WHEN v_missing_photos = 1 THEN 'Zostało jedno miejsce bez zdjęcia' || v_city || '. Dodaj je, zanim zapomnisz.'
          ELSE v_missing_photos || ' miejsc bez zdjęcia' || v_city || '. Dodaj je, zanim zapomnisz.'
        END;
      END IF;
    ELSIF v_missing_notes > 0 THEN
      IF v_en THEN
        v_title := 'Finish your trip ✍️';
        v_body  := CASE
          WHEN v_missing_notes = 1 THEN 'Photos are complete - one place on your trip' || v_city || ' still needs a note.'
          ELSE 'Photos are complete - ' || v_missing_notes || ' places on your trip' || v_city || ' still need notes.'
        END;
      ELSE
        v_title := 'Dokończ swój wyjazd ✍️';
        v_body  := CASE
          WHEN v_missing_notes = 1 THEN 'Zdjęcia masz komplet - została notka do jednego miejsca' || v_city || '.'
          ELSE 'Zdjęcia masz komplet - zostały notki do ' || v_missing_notes || ' miejsc' || v_city || '.'
        END;
      END IF;
    ELSE
      IF v_en THEN
        v_title := 'Your trip is ready to publish 🎉';
        v_body  := 'Photos and notes are complete for your trip' || v_city || '. Publish it so it shows up in Explore.';
      ELSE
        v_title := 'Wyjazd gotowy do publikacji 🎉';
        v_body  := 'Zdjęcia i notki masz komplet' || v_city || '. Opublikuj wyjazd, żeby pojawił się w eksploracji.';
      END IF;
    END IF;
    -- Zawsze widok wyjazdu: tam uzupelnia sie zdjecia/notki/opis i stamtad publikuje (2026-08-30).
    v_url := '/route/' || COALESCE(NEW.route_id::text, '');

  ELSIF NEW.type = 'trip_places_reminder' THEN
    IF v_en THEN
      v_title := 'Add places to the trip 📍';
      v_body  := v_actor_name || ' is waiting for your place suggestions'
                 || COALESCE(' for the trip to ' || initcap(NEW.metadata->>'city'), '');
    ELSE
      v_title := 'Dodaj miejsca do wyjazdu 📍';
      v_body  := v_actor_name || ' czeka na Twoje propozycje miejsc'
                 || COALESCE(' na wyjazd po ' || initcap(NEW.metadata->>'city'), '');
    END IF;
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');

  ELSIF NEW.type = 'trip_message' THEN
    IF v_en THEN
      v_title := 'New message 💬';
      v_body  := v_actor_name || ' posted' || COALESCE(' in “' || v_title_meta || '”',
                   CASE WHEN COALESCE(NEW.metadata->>'city','') <> '' THEN ' in the trip to ' || initcap(NEW.metadata->>'city') ELSE '' END);
    ELSE
      v_title := 'Nowa wiadomość 💬';
      v_body  := v_actor_name || ' napisał(a)' || COALESCE(' w „' || v_title_meta || '”',
                   CASE WHEN COALESCE(NEW.metadata->>'city','') <> '' THEN ' w wyjeździe po ' || initcap(NEW.metadata->>'city') ELSE '' END);
    END IF;
    v_url   := '/route/' || COALESCE(NEW.route_id::text, '');

  ELSE -- route_used (legacy: nic go juz nie tworzy, zastapil go discovery_used)
    IF v_en THEN
      v_title := 'Someone is using your trip 🧭';
      v_body  := v_actor_name || ' saved your trip' || COALESCE(' to ' || initcap(NEW.metadata->>'city'), '');
    ELSE
      v_title := 'Ktoś korzysta z Twojej trasy 🧭';
      v_body  := v_actor_name || ' zapisał(a) Twoją trasę' || COALESCE(' po ' || initcap(NEW.metadata->>'city'), '');
    END IF;
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
