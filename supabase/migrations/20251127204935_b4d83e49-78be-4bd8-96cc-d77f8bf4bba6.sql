-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.admin_user_stats;

CREATE OR REPLACE VIEW public.admin_user_stats 
WITH (security_invoker=on)
AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.created_at as registered_at,
  COUNT(DISTINCT r.id) as routes_count,
  COUNT(DISTINCT l.route_id) as likes_count,
  COUNT(DISTINCT c.id) as comments_count
FROM public.profiles p
LEFT JOIN public.routes r ON r.user_id = p.id
LEFT JOIN public.likes l ON l.user_id = p.id
LEFT JOIN public.comments c ON c.user_id = p.id
GROUP BY p.id, p.username, p.avatar_url, p.created_at;

-- Fix function search path to be empty and use fully qualified names
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;