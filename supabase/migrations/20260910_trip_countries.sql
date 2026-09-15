-- Wyjazd/lista opisane KRAJAMI, nie miastem (decyzja Nat 2026-09-10).
--
-- Do dzis zasieg byl jednomiastowy (`city`), co lamalo sie na kazdym realnym wyjezdzie:
-- "Toskania", "roadtrip po Portugalii", weekend Gdansk+Sopot. Kraj (albo kilka) opisuje
-- taki wyjazd uczciwie, a wyszukiwarka miejsc dostaje szerszy, ale wciaz sensowny zasieg.
--
-- `city` ZOSTAJE: trzyma je ~19 tys. istniejacych wierszy, czyta je pol aplikacji (mapy,
-- geokod srodka, podpisy kart) i nie ma powodu tego przepisywac w jednym kroku. Nowe wyjazdy
-- po prostu przestaja je ustawiac przy tworzeniu.

alter table public.routes
  add column if not exists countries text[] not null default '{}';

alter table public.discovery_collections
  add column if not exists countries text[] not null default '{}';

-- Wsteczne wypelnienie z miasta jest NIEMOZLIWE po stronie SQL (slownik miast zyje w kodzie
-- src/lib/tripCountries.ts), wiec stare wiersze zostaja z pusta tablica. Kod czyta kraje
-- z fallbackiem na `city` - patrz `tripScope()` w src/lib/tripScope.ts.

create index if not exists routes_countries_idx on public.routes using gin (countries);
create index if not exists discovery_collections_countries_idx on public.discovery_collections using gin (countries);
