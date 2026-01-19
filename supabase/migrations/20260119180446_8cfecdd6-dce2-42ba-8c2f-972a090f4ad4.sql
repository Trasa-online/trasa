-- Add new notification type for discovery usage
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'discovery_used';

-- Create function to notify original discoverer when their place is used
CREATE OR REPLACE FUNCTION public.notify_on_discovery_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  route_owner_id uuid;
  route_id_var uuid;
BEGIN
  -- Get route owner
  SELECT user_id, id INTO route_owner_id, route_id_var
  FROM public.routes
  WHERE id = NEW.route_id;

  -- Only notify if:
  -- 1. Pin has an original_creator_id
  -- 2. Original creator is different from route owner (someone else is using their discovery)
  -- 3. Route is published (don't notify for drafts)
  IF NEW.original_creator_id IS NOT NULL 
     AND NEW.original_creator_id != route_owner_id
     AND (SELECT status FROM public.routes WHERE id = NEW.route_id) = 'published' THEN
    
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    VALUES (
      NEW.original_creator_id,
      'discovery_used'::public.notification_type,
      route_owner_id,
      route_id_var
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new pins
CREATE TRIGGER notify_on_discovery_used_trigger
  AFTER INSERT ON public.pins
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_discovery_used();