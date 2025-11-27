-- Fix search_path security issues for notification functions

-- Update notify_on_like function
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only create notification if someone else liked the route
  IF NEW.user_id != (SELECT user_id FROM public.routes WHERE id = NEW.route_id) THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT r.user_id, 'like'::public.notification_type, NEW.user_id, NEW.route_id
    FROM public.routes r
    WHERE r.id = NEW.route_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update notify_on_comment function
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only create notification if someone else commented on the route
  IF NEW.user_id != (SELECT user_id FROM public.routes WHERE id = NEW.route_id) THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id, comment_id)
    SELECT r.user_id, 'comment'::public.notification_type, NEW.user_id, NEW.route_id, NEW.id
    FROM public.routes r
    WHERE r.id = NEW.route_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update notify_on_follow function
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follower'::public.notification_type, NEW.follower_id);
  RETURN NEW;
END;
$$;

-- Update notify_followers_on_new_route function
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_route()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only notify when route is published (not on drafts or updates)
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'new_route'::public.notification_type, NEW.user_id, NEW.id
    FROM public.followers f
    WHERE f.following_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;