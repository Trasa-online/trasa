-- Add new notification type for route updates
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'route_updated';

-- Drop and recreate the trigger function to handle updates
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_route()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Notify when route is first published (from draft or new insert)
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'new_route'::public.notification_type, NEW.user_id, NEW.id
    FROM public.followers f
    WHERE f.following_id = NEW.user_id;
  -- Notify when already published route is updated (e.g., title, description, or pins changed)
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'published' AND NEW.updated_at > OLD.updated_at THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'route_updated'::public.notification_type, NEW.user_id, NEW.id
    FROM public.followers f
    WHERE f.following_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;