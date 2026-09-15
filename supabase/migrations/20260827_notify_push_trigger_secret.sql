-- Naprawa kanalu PUSH: notify_push wolal send-push kluczem anon w Authorization, a send-push
-- (po hardeningu [H2]) odrzuca anon (401) -> push nie wychodzil na telefon (powiadomienia w apce
-- dzialaly, bo insert do notifications sie udaje - http_post jest w EXCEPTION...NULL).
-- Fix: notify_push uwierzytelnia sie WSPOLNYM sekretem x-trigger-secret (Vault: push_trigger_secret),
-- ktory send-push akceptuje jako wywolanie wewnetrzne (isTrigger). Niezalezne od rotacji service_role.
-- Wszystko ryzykowne (odczyt Vault + http_post) opakowane w EXCEPTION - nigdy nie blokuje notyfikacji.
create or replace function public.notify_push()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE v_actor_name TEXT; v_title TEXT; v_body TEXT; v_url TEXT; v_payload jsonb; v_secret TEXT;
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

  v_payload := jsonb_build_object('user_id', NEW.user_id, 'title', v_title, 'body', v_body, 'url', v_url);

  -- Sekret trigera z Vault (exception-safe: brak sekretu -> pusty naglowek -> send-push odrzuci push,
  -- ale notyfikacja i tak sie zapisze).
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
    NULL; -- push best-effort, nie blokuje notyfikacji
  END;

  RETURN NEW;
END;
$function$;
