CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.suggested_users_by_city(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  shared_city TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT ON (p.id)
    p.id, p.username, p.first_name, p.avatar_url,
    r.city AS shared_city
  FROM public.profiles p
  JOIN public.routes r ON r.user_id = p.id AND r.is_shared = true
  WHERE r.city IN (
    SELECT DISTINCT city FROM public.routes
    WHERE user_id = p_user_id AND city IS NOT NULL
  )
  AND p.id != p_user_id
  AND p.id NOT IN (
    SELECT following_id FROM public.followers WHERE follower_id = p_user_id
  )
  ORDER BY p.id, r.created_at DESC
  LIMIT 10;
$$;
