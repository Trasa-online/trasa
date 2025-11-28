-- Fix search_path for increment_route_views function
CREATE OR REPLACE FUNCTION increment_route_views(route_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.routes
  SET views = views + 1
  WHERE id = route_id;
END;
$$;