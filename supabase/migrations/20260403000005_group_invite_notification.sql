-- Add group_invite to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'group_invite';

-- SECURITY DEFINER function: send a group session invitation
-- Called from the frontend; validates membership before inserting notification.
CREATE OR REPLACE FUNCTION send_group_invite(
  p_target_user_id uuid,
  p_session_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  -- Caller must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch session details
  SELECT id, city, join_code, status
  INTO v_session
  FROM group_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'Session is no longer active';
  END IF;

  -- Caller must be a member of the session
  IF NOT EXISTS (
    SELECT 1 FROM group_session_members
    WHERE session_id = p_session_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not a member of this session';
  END IF;

  -- Don't invite yourself
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot invite yourself';
  END IF;

  -- Insert the invitation notification (upsert to avoid duplicates)
  INSERT INTO notifications (user_id, type, actor_id, read, metadata)
  VALUES (
    p_target_user_id,
    'group_invite',
    auth.uid(),
    false,
    jsonb_build_object(
      'session_id', p_session_id::text,
      'join_code',  v_session.join_code,
      'city',       v_session.city
    )
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION send_group_invite(uuid, uuid) TO authenticated;
