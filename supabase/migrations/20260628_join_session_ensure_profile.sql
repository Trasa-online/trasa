-- Fix: dolaczanie do sesji grupowej z web/anon lamalo FK
-- group_session_members.user_id -> profiles(id), bo anon/swiezy OAuth user nie mial jeszcze
-- wiersza w profiles (handle_new_user pomija anon). join_group_session teraz najpierw
-- gwarantuje profile (ensure_current_user_profile), potem wstawia czlonka. Server-side =
-- chroni wszystkie sciezki (web + native), niezaleznie od fixu klienckiego.
CREATE OR REPLACE FUNCTION public.join_group_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_current_user_profile();
  INSERT INTO public.group_session_members (session_id, user_id)
  VALUES (p_session_id, auth.uid())
  ON CONFLICT (session_id, user_id) DO NOTHING;
END;
$$;
