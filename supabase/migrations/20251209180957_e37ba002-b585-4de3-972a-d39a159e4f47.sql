-- Add new notification type for visit comments
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'visit_comment';

-- Create trigger function to notify visit owner when someone comments on their rating
CREATE OR REPLACE FUNCTION public.notify_on_visit_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only create notification if someone else commented (not the visit owner themselves)
  IF NEW.user_id != NEW.visit_user_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id)
    VALUES (NEW.visit_user_id, 'visit_comment'::public.notification_type, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for visit comments
CREATE TRIGGER notify_on_visit_comment_trigger
  AFTER INSERT ON public.visit_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_visit_comment();