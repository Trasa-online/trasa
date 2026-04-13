-- Bypass RLS for joining a group session.
-- Called from the client via supabase.rpc('join_group_session', { p_session_id }).
CREATE OR REPLACE FUNCTION public.join_group_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_session_members (session_id, user_id)
  VALUES (p_session_id, auth.uid())
  ON CONFLICT (session_id, user_id) DO NOTHING;
END;
$$;
