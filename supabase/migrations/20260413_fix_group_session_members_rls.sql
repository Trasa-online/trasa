-- Fix group session RLS issues introduced in 20260412.
--
-- Problem 1: group_sessions SELECT was too restrictive —
--   new users joining via code couldn't read the session (not yet a member).
--   Solution: restore permissive read (join_code acts as the secret).
--
-- Problem 2: group_session_members SELECT had infinite recursion —
--   the policy queried the same table it was protecting.
--   Solution: use a SECURITY DEFINER helper function.

-- ── 1. Helper function (bypasses RLS for the membership check) ────────────────
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

-- ── 2. group_sessions: restore open read (needed to join by code) ─────────────
DROP POLICY IF EXISTS "Members can read their group sessions" ON public.group_sessions;
DROP POLICY IF EXISTS "Auth users can read group sessions"    ON public.group_sessions;

CREATE POLICY "Auth users can read group sessions"
  ON public.group_sessions FOR SELECT TO authenticated
  USING (true);

-- ── 3. group_session_members: fix infinite recursion ─────────────────────────
DROP POLICY IF EXISTS "Members can read members in their sessions" ON public.group_session_members;
DROP POLICY IF EXISTS "Auth users can read group members"          ON public.group_session_members;

CREATE POLICY "Members can read members in their sessions"
  ON public.group_session_members FOR SELECT TO authenticated
  USING (public.is_group_session_member(session_id));
