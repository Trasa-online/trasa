-- Security hardening RLS (audyt bezpieczenstwa 2026-06-27).
-- Zamkniecie zbyt permisywnych polityk ZAPISU. Klient odczytuje obie tabele (DiscoveryFeed,
-- pinDiscovery) - NIE pisze do nich z apki, wiec ograniczenie zapisu do admina nic nie psuje.

-- ── C1 (CRITICAL): creator_plans ─────────────────────────────────────────────
-- Bylo: "Authenticated write" FOR ALL USING (auth.role() = 'authenticated') -> kazdy
-- zalogowany (w tym anonymous auth) mogl INSERT/UPDATE/DELETE dowolny wiersz.
DROP POLICY IF EXISTS "Authenticated write" ON public.creator_plans;
CREATE POLICY "Admins manage creator_plans" ON public.creator_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── H1 (HIGH): canonical_pins ────────────────────────────────────────────────
-- Bylo: "Users can update canonical pins" FOR UPDATE USING (true) -> kazdy (nawet anon)
-- mogl nadpisac dowolny kanoniczny (wspoldzielony) pin = zatruwanie danych globalnych.
DROP POLICY IF EXISTS "Users can update canonical pins" ON public.canonical_pins;
CREATE POLICY "Admins update canonical pins" ON public.canonical_pins
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
