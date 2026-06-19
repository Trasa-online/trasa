-- Admin: pelny dostep do discovery_items (moderacja zestawien + leady custom miejsc).
-- Bez tego promote-custom-to-lead nie moze przelinkowac itemow cudzych rankingow
-- (UPDATE place_id), a podglad custom miejsc w ukrytych/szkicowych kolekcjach jest
-- zablokowany przez discovery_items_public_read (tylko is_public AND NOT hidden).

CREATE POLICY "discovery_items_admin_all" ON discovery_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
