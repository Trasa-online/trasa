-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create view for admin dashboard
CREATE OR REPLACE VIEW public.admin_user_stats AS
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

-- Grant access to view for admins only
GRANT SELECT ON public.admin_user_stats TO authenticated;