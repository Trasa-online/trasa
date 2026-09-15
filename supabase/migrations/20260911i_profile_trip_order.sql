-- Wlasny uklad okladek na profilu (prosba Nat 2026-09-11).
--
-- Nat trafila na "blad", ktory okazal sie natywnym podgladem przeciagania obrazka
-- w WKWebView, i chce z tego funkcje: przytrzymanie kafelka na siatce Wspomnien
-- i przestawienie okladek. Kolejnosc jest czescia wizerunku profilu, wiec musi byc
-- WSPOLNA dla wszystkich ogladajacych (profil publiczny tez ja pokazuje) - stad
-- baza, nie localStorage jak sam wybor ukladu (lista/siatka/mozaika).
--
-- Jedna tablica na usera zamiast kolumny w `routes`: zapis jednym upsertem (atomowo,
-- bez N update'ow ani RPC), zero wplywu na kolejnosc eksploracji (published_at) i na
-- triggery `routes`. Wyjazd, ktorego nie ma w tablicy (swiezo opublikowany), klient
-- stawia NA POCZATKU, w domyslnej kolejnosci (najnowsze pierwsze); usuniety wyjazd
-- w tablicy jest po prostu pomijany. Stare buildy tabeli nie znaja i nic ich nie boli.

create table if not exists public.profile_trip_order (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  route_ids  uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.profile_trip_order enable row level security;

-- Uklad jest widoczny dla kazdego, kto widzi profil.
drop policy if exists "profile_trip_order: public read" on public.profile_trip_order;
create policy "profile_trip_order: public read" on public.profile_trip_order
  for select to anon, authenticated using (true);

-- Ustawiac moze tylko wlasciciel profilu.
drop policy if exists "profile_trip_order: owner insert" on public.profile_trip_order;
create policy "profile_trip_order: owner insert" on public.profile_trip_order
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profile_trip_order: owner update" on public.profile_trip_order;
create policy "profile_trip_order: owner update" on public.profile_trip_order
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.profile_trip_order to anon, authenticated;
grant insert, update on public.profile_trip_order to authenticated;
