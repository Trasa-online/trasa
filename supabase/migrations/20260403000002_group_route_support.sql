-- Add group_session_id to routes so shared group routes are visible to all members
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS group_session_id UUID REFERENCES public.group_sessions(id) ON DELETE SET NULL;

-- Allow group members to read routes tagged with their session
CREATE POLICY "Group members can read shared routes"
  ON public.routes FOR SELECT
  USING (
    group_session_id IS NOT NULL AND
    group_session_id IN (
      SELECT session_id FROM public.group_session_members WHERE user_id = auth.uid()
    )
  );
