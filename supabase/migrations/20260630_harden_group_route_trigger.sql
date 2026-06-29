-- ─────────────────────────────────────────────────────────────────────────────
-- Utwardzenie triggera notify_group_route_ready (z 20260406).
--
-- Problem: trigger odpala sie AFTER INSERT na member-route i robi (a) insert
-- powiadomienia (b) push przez extensions.net.http_post (pg_net). Ta sciezka
-- NIGDY wczesniej nie dzialala (kopie czlonkow padaly na RLS), wiec jesli pg_net
-- nie jest skonfigurowany albo http_post rzuca, CALY insert member-route robi
-- rollback -> partycypant nie dostaje trasy mimo poprawnego RPC.
--
-- Fix: side-effecty (powiadomienie + push) owijamy w BEGIN/EXCEPTION. Blad
-- powiadomienia/pusha NIGDY nie blokuje utworzenia trasy. Push jest best-effort.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_group_route_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_payload    text;
BEGIN
  IF NEW.group_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_actor_id := auth.uid();

  -- Pomin trase wlasna organizatora (powiadamiamy tylko innych czlonkow).
  IF v_actor_id IS NULL OR NEW.user_id = v_actor_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(first_name, username, 'Organizator')
  INTO v_actor_name
  FROM profiles WHERE id = v_actor_id;

  -- (a) Powiadomienie in-app - best effort, nie blokuje insertu trasy.
  BEGIN
    INSERT INTO notifications (user_id, type, actor_id, read, metadata)
    VALUES (
      NEW.user_id, 'group_route_ready', v_actor_id, false,
      jsonb_build_object('route_id', NEW.id::text, 'city', COALESCE(NEW.city, ''))
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nie przerywaj tworzenia trasy
  END;

  -- (b) Push - best effort, nie blokuje insertu trasy (np. brak pg_net).
  BEGIN
    v_payload := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   'Trasa gotowa! 🗺️',
      'body',    v_actor_name || ' stworzył(a) trasę' || CASE WHEN NEW.city IS NOT NULL THEN ' w ' || initcap(NEW.city) ELSE '' END,
      'url',     '/moje-podroze'
    )::text;

    PERFORM extensions.net.http_post(
      url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/send-push',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU"}'::jsonb,
      body    := v_payload
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- push best-effort
  END;

  RETURN NEW;
END;
$$;
