-- Drop and recreate the function to only notify on REAL content changes
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_route()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify when route is first published (from draft or new insert)
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'new_route'::public.notification_type, NEW.user_id, NEW.id
    FROM public.followers f
    WHERE f.following_id = NEW.user_id;
  -- Notify when already published route has ACTUAL content changes (title or description)
  ELSIF TG_OP = 'UPDATE' 
    AND OLD.status = 'published' 
    AND NEW.status = 'published' 
    AND (
      OLD.title IS DISTINCT FROM NEW.title OR 
      OLD.description IS DISTINCT FROM NEW.description
    ) THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    SELECT f.follower_id, 'route_updated'::public.notification_type, NEW.user_id, NEW.id
    FROM public.followers f
    WHERE f.following_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;