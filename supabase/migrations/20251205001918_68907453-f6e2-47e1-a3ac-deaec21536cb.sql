-- Add new notification type for pin visits/ratings
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pin_visit';

-- Create function to notify route owner when someone visits their pin
CREATE OR REPLACE FUNCTION public.notify_on_pin_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  route_owner_id uuid;
  route_id_var uuid;
BEGIN
  -- Get route owner and route_id from the pin
  SELECT r.user_id, r.id INTO route_owner_id, route_id_var
  FROM public.pins p
  JOIN public.routes r ON r.id = p.route_id
  WHERE p.id = NEW.pin_id;

  -- Only create notification if someone else visited the pin (not the route owner)
  IF NEW.user_id != route_owner_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, route_id)
    VALUES (route_owner_id, 'pin_visit'::public.notification_type, NEW.user_id, route_id_var);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for pin visits
DROP TRIGGER IF EXISTS notify_on_pin_visit_trigger ON public.pin_visits;
CREATE TRIGGER notify_on_pin_visit_trigger
  AFTER INSERT ON public.pin_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_pin_visit();