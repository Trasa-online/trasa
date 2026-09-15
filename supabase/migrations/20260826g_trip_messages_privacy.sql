-- Prywatnosc czatu (2026-08-26): stara polityka read pozwalala czytac gdy routes.is_shared=true
-- (czyli KAZDY zalogowany dla wyjazdu grupowego/opublikowanego). Zawezamy do UCZESTNIKOW:
-- wlasciciel LUB czlonek sesji grupowej. Czat = prywatna rozmowa, nie publiczna tresc.
DROP POLICY IF EXISTS "read trip messages" ON public.trip_messages;
CREATE POLICY "read trip messages" ON public.trip_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));
