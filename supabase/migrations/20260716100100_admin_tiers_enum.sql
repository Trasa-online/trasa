-- FUNDAMENT admin.trasa.travel (2/3): dodanie wartosci enuma dla tierow ról.
--
-- WAZNE (ograniczenie Postgresa): ALTER TYPE ... ADD VALUE nie moze byc uzyty
-- w tej samej transakcji, w ktorej nowa wartosc jest UZYWANA. Dlatego dodanie
-- wartosci jest w OSOBNEJ migracji (tu), a nadanie tierow uzywajace tych
-- wartosci - w kolejnej (3/3). Uruchom te migracje jako pierwsza, oddzielnie.
--
-- Model: kazdy admin ma wiersz 'admin' (baza, nie ruszamy - cale istniejace
-- RLS i edge guardy wisza na has_role(uid,'admin')) + wiersz tieru:
--   super_admin = pelne prawa (usuwanie kont, zmiana rol, bulk-mail)
--   operator    = moderacja/odpowiedzi (bez operacji nieodwracalnych)

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';
