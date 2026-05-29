-- RPC: admin_list_users()
-- Zwraca liste userow z profiles JOIN z auth.users.is_anonymous, zeby Admin panel
-- mogl odroznic anonimowych userow (utworzonych przez ensure_current_user_profile
-- przy grupowym parowaniu na native) od prawdziwych zarejestrowanych kont.
--
-- SECURITY DEFINER z gate'em na user_roles.role = 'admin' (parity z Admin.tsx
-- ktory tez sprawdza t€ tabele po stronie klienta - RLS by tu nie wystarczyl bo
-- auth.users nie jest dostepny przez normalny SELECT).

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  is_anonymous BOOLEAN
)
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Gate: tylko admin moze listowac userow
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.username,
      p.first_name,
      p.avatar_url,
      p.created_at,
      COALESCE(u.is_anonymous, false) AS is_anonymous
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC
    LIMIT 200;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
