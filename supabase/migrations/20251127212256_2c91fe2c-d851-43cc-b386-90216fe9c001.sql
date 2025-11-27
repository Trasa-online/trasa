-- Create notification type enum
CREATE TYPE public.notification_type AS ENUM ('like', 'comment', 'follower', 'new_route');

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type notification_type NOT NULL,
  actor_id UUID NOT NULL,
  route_id UUID,
  comment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to notify on new like
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create notification if someone else liked the route
  IF NEW.user_id != (SELECT user_id FROM routes WHERE id = NEW.route_id) THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT r.user_id, 'like'::notification_type, NEW.user_id, NEW.route_id
    FROM routes r
    WHERE r.id = NEW.route_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_created
AFTER INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_like();

-- Create function to notify on new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create notification if someone else commented on the route
  IF NEW.user_id != (SELECT user_id FROM routes WHERE id = NEW.route_id) THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id, comment_id)
    SELECT r.user_id, 'comment'::notification_type, NEW.user_id, NEW.route_id, NEW.id
    FROM routes r
    WHERE r.id = NEW.route_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_created
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();

-- Create function to notify on new follower
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follower'::notification_type, NEW.follower_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follower_created
AFTER INSERT ON public.followers
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow();

-- Create function to notify followers on new published route
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_route()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only notify when route is published (not on drafts or updates)
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'new_route'::notification_type, NEW.user_id, NEW.id
    FROM followers f
    WHERE f.following_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_route_published
AFTER INSERT OR UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_on_new_route();

-- Create index for better query performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);