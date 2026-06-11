-- [C1] pin_ratings byly world-readable (FOR SELECT USING(true)) -> wyciek
-- prywatnych notek i ocen WSZYSTKICH userow, takze z tras nieudostepnionych.
-- Nowa policy: czytasz wlasne oceny/notki ALBO oceny/notki przypisane do trasy
-- ktora jest udostepniona (is_shared=true) - to zachowuje widok SharedRoute.
DROP POLICY IF EXISTS "Anyone can read pin ratings" ON public.pin_ratings;

CREATE POLICY "Read own or shared-route pin ratings" ON public.pin_ratings
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = pin_ratings.route_id AND r.is_shared = true
    )
  );
