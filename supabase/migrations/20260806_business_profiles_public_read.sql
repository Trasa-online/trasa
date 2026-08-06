-- REGRESJA: hardening bezpieczenstwa usunal oryginalna publiczna polityke SELECT
-- ("Anyone can read active business profiles" z 20260406_business_profiles.sql, USING is_active=true),
-- zostawiajac tylko "Owner can read own profile" (owner_user_id = auth.uid()). Skutek: apka B2C
-- (czyta anonem / jako niewlascicielski user) NIE widziala ZADNEGO lokalu premium - wizytowki
-- znikly z eksploracji i tras. Wizytowki sa PUBLICZNE z zalozenia (caly sens B2B = widocznosc
-- w trasach userow). Przywracamy oryginalna polityke (gated na is_active, wiec ukryte profile
-- pozostaja niewidoczne). Widocznosc dodatkowo bramkuje places.is_active w zapytaniu apki.
DROP POLICY IF EXISTS "Public can read business profiles" ON public.business_profiles;
DROP POLICY IF EXISTS "Anyone can read active business profiles" ON public.business_profiles;
CREATE POLICY "Anyone can read active business profiles"
  ON public.business_profiles
  FOR SELECT
  USING (is_active = true);
