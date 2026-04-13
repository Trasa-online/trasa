-- Fix: INSERT policy on group_session_members was lost in previous RLS migrations.
-- Also extend UPDATE policy so session creator can advance all members (skip waiting).

DROP POLICY IF EXISTS "Users can join sessions" ON public.group_session_members;
CREATE POLICY "Users can join sessions"
  ON public.group_session_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own membership"        ON public.group_session_members;
DROP POLICY IF EXISTS "Session creator can update members"    ON public.group_session_members;
CREATE POLICY "Session creator can update members"
  ON public.group_session_members FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_sessions
      WHERE id = session_id AND created_by = auth.uid()
    )
  );
