-- Fix overly permissive RLS on group_sessions and group_session_members.
-- Previously any authenticated user could enumerate ALL sessions.
-- Now visibility is limited to participants only.

-- group_sessions: replace "all authenticated" SELECT with member-scoped policy
DROP POLICY IF EXISTS "Auth users can read group sessions" ON public.group_sessions;
CREATE POLICY "Members can read their group sessions"
  ON public.group_sessions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT session_id FROM public.group_session_members WHERE user_id = auth.uid()
    )
  );

-- group_session_members: replace "all authenticated" SELECT with session-scoped policy
DROP POLICY IF EXISTS "Auth users can read group members" ON public.group_session_members;
CREATE POLICY "Members can read members in their sessions"
  ON public.group_session_members FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT session_id FROM public.group_session_members WHERE user_id = auth.uid()
    )
  );
