-- KOSZ A KONTO ADMINA: usunieta kolekcja zostawala na ekranie (zgloszenie Nat 2026-09-24).
--
-- Objaw: "usuwam kolekcje, wracam na profil i nadal ja widze". Zdiagnozowane NIE jako cache
-- klienta (`invalidateContentLists` dziala), tylko jako RLS. Migracja 20260915b dopisala
-- `deleted_at IS NULL` do KAZDEJ polityki SELECT na `discovery_collections` POZA jedna:
-- `discovery_collections_admin_all` (FOR ALL) zostala swiadomie bez tego warunku, zeby panel
-- ops widzial takze tresc w koszu. Skutek uboczny: dla kazdego, kto ma role admin - czyli dla
-- calego zespolu, ktory testuje apke na swoich kontach - kosz nie dziala W OGOLE. Wyjazdy
-- znikaly poprawnie (`routes` nie ma polityki admina), kolekcje zostawaly.
--
-- Zmierzone na prodzie przed poprawka (BEGIN ... ROLLBACK, konto Nat, `set role authenticated`):
-- kolekcja z ustawionym `deleted_at` wracala w zapytaniu profilu razem z zywymi.
--
-- Poprawka: admin traci prawo ODCZYTU wierszy z kosza, zachowuje pelne prawo zapisu
-- (moderacja, ukrywanie, kasowanie). Polityka ALL rozbita na trzy - SELECT z warunkiem,
-- UPDATE i DELETE bez.
--
-- ⛔ Gdyby panel ops kiedys naprawde potrzebowal zajrzec do kosza (zgloszenie tresci, ktora
-- autor w miedzyczasie usunal), robi to WASKIM RPC SECURITY DEFINER dla tej jednej sprawy,
-- a nie polityka wpuszczajaca kosz do calej aplikacji. Dzis zadne miejsce w panelu tego nie
-- czyta: moduł "Zestawienia" listuje kolekcje do moderacji, a tresc usunieta nie czeka na
-- decyzje - po 7 dniach kasuje ja cron.

DROP POLICY IF EXISTS discovery_collections_admin_all ON public.discovery_collections;

CREATE POLICY discovery_collections_admin_read ON public.discovery_collections FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)
  );

CREATE POLICY discovery_collections_admin_update ON public.discovery_collections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

CREATE POLICY discovery_collections_admin_delete ON public.discovery_collections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

-- INSERT zostaje przy `discovery_collections_auth_insert` (wlasny wiersz) - admin nie zaklada
-- kolekcji w cudzym imieniu z panelu i nigdy tego nie robil.

-- ⛔ `discovery_items` ZOSTAJE bez zmian. Pozycje kolekcji sa niewidoczne przez RODZICA -
-- czytamy je zawsze dla kolekcji, ktora juz mamy - i tak samo dziala to dla zwyklego usera
-- (`discovery_items_owner_read` tez nie sprawdza `deleted_at` rodzica). Dokladanie tu warunku
-- zmienialoby model widocznosci dzieci przy okazji naprawy czego innego.
