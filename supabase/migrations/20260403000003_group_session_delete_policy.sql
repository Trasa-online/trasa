-- Allow session creator to delete their own group sessions
CREATE POLICY "Creators can delete own sessions"
  ON public.group_sessions FOR DELETE TO authenticated
  USING (auth.uid() = created_by);
