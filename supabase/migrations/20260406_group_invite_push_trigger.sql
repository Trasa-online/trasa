-- Trigger: send push notification via pg_net whenever a group_invite
-- notification is inserted. Runs server-side so it's reliable regardless
-- of whether the inviting user's browser is still open.

CREATE OR REPLACE FUNCTION notify_group_invite_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_city       TEXT;
  v_join_code  TEXT;
  v_payload    TEXT;
BEGIN
  IF NEW.type != 'group_invite' THEN
    RETURN NEW;
  END IF;

  -- Resolve actor display name
  SELECT COALESCE(first_name, username, 'Ktoś')
  INTO v_actor_name
  FROM profiles
  WHERE id = NEW.actor_id;

  v_city      := NEW.metadata->>'city';
  v_join_code := NEW.metadata->>'join_code';

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title',   'Zaproszenie do sesji 🗺️',
    'body',    v_actor_name || ' zaprasza Cię do sesji' || COALESCE(' w ' || initcap(v_city), ''),
    'url',     '/sesja/' || v_join_code
  )::text;

  -- Call send-push Edge Function (verify_jwt=false, anon key is sufficient)
  PERFORM extensions.net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU"}'::jsonb,
    body    := v_payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_group_invite_push ON notifications;
CREATE TRIGGER trigger_group_invite_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_invite_push();
