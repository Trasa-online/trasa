-- "Gdzie juz bylem" na listach miejsc (2026-09-08, zgloszenie z testow)
--
-- Decyzja modelowa: odwiedziny naleza do OGLADAJACEGO, nie do listy. Gdyby siedzialy
-- w discovery_items, odhaczenie miejsca na CUDZEJ zapisanej liscie zmienialoby ja wszystkim
-- - a "bylem tu" to fakt o mnie, nie o liscie.
--
-- Klucz to `place_key` (ten sam, ktory liczy placeKeyOf w src/lib/placePhotoSocial.ts:
-- 'gpid:{google_place_id}' albo 'nm:{nazwa}'), a nie id pozycji listy. Dzieki temu jedno
-- odhaczenie widac wszedzie, gdzie to miejsce wystepuje: na kazdej liscie, ktora je zawiera,
-- i w wizytowce. Inaczej user musialby odhaczac to samo miejsce osobno na kazdej liscie.

create table if not exists public.place_visits (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  place_key  text        not null,
  place_name text,
  city       text,
  visited_at timestamptz not null default now(),
  -- 'manual' = user odhaczyl recznie; 'trip' = wynika z odwiedzonego pinu w wyjezdzie.
  source     text        not null default 'manual' check (source in ('manual', 'trip')),
  primary key (user_id, place_key)
);

create index if not exists place_visits_user_idx on public.place_visits (user_id, visited_at desc);

alter table public.place_visits enable row level security;

-- Wylacznie wlasne odwiedziny - to prywatna informacja o tym, gdzie ktos bywa.
drop policy if exists "own visits readable" on public.place_visits;
create policy "own visits readable" on public.place_visits
  for select using (auth.uid() = user_id);
drop policy if exists "own visits writable" on public.place_visits;
create policy "own visits writable" on public.place_visits
  for insert with check (auth.uid() = user_id);
drop policy if exists "own visits deletable" on public.place_visits;
create policy "own visits deletable" on public.place_visits
  for delete using (auth.uid() = user_id);
