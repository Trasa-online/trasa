-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Allow group session organizer to INSERT routes for other members
--    (previously blocked by the base policy: auth.uid() = user_id)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Group organizer can save routes for members"
  ON routes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      group_session_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM group_sessions
        WHERE id = group_session_id
          AND created_by = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Allow group session organizer to INSERT pins for member routes
--    (previously blocked: route must be owned by auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Group organizer can save pins for member routes"
  ON pins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = pins.route_id
        AND (
          routes.user_id = auth.uid()
          OR (
            routes.group_session_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM group_sessions
              WHERE id = routes.group_session_id
                AND created_by = auth.uid()
            )
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. New notification type: route created for a group member by organizer
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'group_route_ready';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: when organizer saves route for a member, notify them + push
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_group_route_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_name TEXT;
  v_payload    TEXT;
BEGIN
  -- Only group session routes saved for someone else
  IF NEW.group_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_actor_id := auth.uid();

  -- If inserter is the same as owner (their own route), skip
  IF NEW.user_id = v_actor_id THEN
    RETURN NEW;
  END IF;

  -- Get organizer display name
  SELECT COALESCE(first_name, username, 'Organizator')
  INTO v_actor_name
  FROM profiles
  WHERE id = v_actor_id;

  -- In-app notification for the member
  INSERT INTO notifications (user_id, type, actor_id, read, metadata)
  VALUES (
    NEW.user_id,
    'group_route_ready',
    v_actor_id,
    false,
    jsonb_build_object(
      'route_id', NEW.id::text,
      'city',     COALESCE(NEW.city, '')
    )
  )
  ON CONFLICT DO NOTHING;

  -- Push notification
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_group_route_ready ON routes;
CREATE TRIGGER trigger_group_route_ready
  AFTER INSERT ON routes
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_route_ready();
