-- Fix infinite recursion in group_session_members RLS policy.
-- The previous policy queried group_session_members from within its own policy,
-- causing infinite recursion. Solution: use a SECURITY DEFINER function that
-- bypasses RLS when checking membership.

-- 1. Helper function (bypasses RLS for the membership check)
CREATE OR REPLACE FUNCTION public.is_group_session_member(sid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_session_members
    WHERE session_id = sid AND user_id = auth.uid()
  );
$$;

-- 2. Re-create the group_session_members SELECT policy using the helper
DROP POLICY IF EXISTS "Members can read members in their sessions" ON public.group_session_members;

CREATE POLICY "Members can read members in their sessions"
  ON public.group_session_members FOR SELECT TO authenticated
  USING (public.is_group_session_member(session_id));

-- 3. Re-create the group_sessions SELECT policy using the helper
DROP POLICY IF EXISTS "Members can read their group sessions" ON public.group_sessions;

CREATE POLICY "Members can read their group sessions"
  ON public.group_sessions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_group_session_member(id)
  );
