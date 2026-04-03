-- Add group_match to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'group_match';

-- Add metadata column to notifications (place_name, session_id, etc.)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Trigger function: notify OTHER session members when a 2-person match is first reached
CREATE OR REPLACE FUNCTION notify_on_group_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_member_id uuid;
BEGIN
  -- Only care about positive reactions
  IF NEW.reaction NOT IN ('liked', 'super_liked') THEN
    RETURN NEW;
  END IF;

  -- Count distinct users who liked this place in this session
  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM group_session_reactions
  WHERE session_id = NEW.session_id
    AND place_name = NEW.place_name
    AND reaction IN ('liked', 'super_liked');

  -- Only fire exactly when crossing the 2-person threshold (prevents duplicate notifications)
  IF v_count = 2 THEN
    FOR v_member_id IN
      SELECT user_id
      FROM group_session_members
      WHERE session_id = NEW.session_id
        AND user_id != NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, type, actor_id, read, metadata)
      VALUES (
        v_member_id,
        'group_match',
        NEW.user_id,
        false,
        jsonb_build_object(
          'place_name', NEW.place_name,
          'session_id', NEW.session_id::text
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_group_match
  AFTER INSERT ON public.group_session_reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_group_match();
