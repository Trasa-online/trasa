-- Add images array column to pins table to support multiple images
ALTER TABLE pins ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Create trigger to notify mentioned users in pins
CREATE OR REPLACE FUNCTION public.notify_mentioned_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mentioned_user_id uuid;
  route_owner_id uuid;
BEGIN
  -- Get the route owner
  SELECT user_id INTO route_owner_id
  FROM public.routes
  WHERE id = NEW.route_id;

  -- Only create notifications when route is published
  IF (SELECT status FROM public.routes WHERE id = NEW.route_id) = 'published' THEN
    -- Create notification for each mentioned user (except the route owner)
    IF NEW.mentioned_users IS NOT NULL THEN
      FOREACH mentioned_user_id IN ARRAY NEW.mentioned_users
      LOOP
        IF mentioned_user_id != route_owner_id THEN
          INSERT INTO public.notifications (user_id, type, actor_id, route_id)
          VALUES (mentioned_user_id, 'mention'::public.notification_type, route_owner_id, NEW.route_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new pins
DROP TRIGGER IF EXISTS notify_on_mention_insert ON public.pins;
CREATE TRIGGER notify_on_mention_insert
AFTER INSERT ON public.pins
FOR EACH ROW
EXECUTE FUNCTION public.notify_mentioned_users();

-- Create trigger for updated pins
DROP TRIGGER IF EXISTS notify_on_mention_update ON public.pins;
CREATE TRIGGER notify_on_mention_update
AFTER UPDATE ON public.pins
FOR EACH ROW
WHEN (OLD.mentioned_users IS DISTINCT FROM NEW.mentioned_users)
EXECUTE FUNCTION public.notify_mentioned_users();