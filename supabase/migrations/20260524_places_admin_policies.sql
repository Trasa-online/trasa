-- Places table mialo tylko SELECT policy dla wszystkich. Admin nie mogl INSERT
-- (np. przy aktywacji lokalu z business_profiles przez panel /admin).
-- Dodaje policies dla admina (user_roles.role = 'admin').

CREATE POLICY "Admins can insert places"
  ON public.places FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update places"
  ON public.places FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete places"
  ON public.places FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
