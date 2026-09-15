-- Udostepnianie DOWOLNEGO miejsca (zgloszenie Nat 2026-09-11: arkusz udostepniania nie
-- otwieral sie dla miejsca z listy, bo dzialal tylko dla wizytowek z tabeli `places`).
--
-- Miejsca w listach i wyjazdach czesto nie maja rekordu w `places` (pochodza z Google albo
-- z reki usera), a `places` jest kurowana i klient nie moze do niej pisac. Zamiast tego
-- udostepnienie zapisuje MIGAWKE miejsca: nazwa, adres, kategoria, wspolrzedne, zdjecie,
-- identyfikator Google (gdy jest). Strona spontaway.com/p/<id> renderuje sie z niej,
-- a jesli migawka wskazuje na wizytowke (place_id), strona bierze pelne dane wizytowki.
--
-- Jedna migawka na (user, miejsce): klucz = google_place_id albo nazwa - ponowne
-- udostepnienie tego samego miejsca oddaje ten sam link.

create table if not exists public.shared_places (
  id              uuid primary key default gen_random_uuid(),
  shared_by       uuid not null references auth.users(id) on delete cascade,
  place_id        uuid null references public.places(id) on delete set null,
  google_place_id text null,
  place_name      text not null,
  address         text null,
  city            text null,
  category        text null,
  latitude        double precision null,
  longitude       double precision null,
  photo_url       text null,
  place_key       text generated always as (coalesce(google_place_id, lower(place_name))) stored,
  created_at      timestamptz not null default now()
);

create unique index if not exists shared_places_owner_key on public.shared_places (shared_by, place_key);

alter table public.shared_places enable row level security;

-- Link jest publiczny z zalozenia - odbiorca bez konta ma zobaczyc miejsce.
drop policy if exists "shared_places: public read" on public.shared_places;
create policy "shared_places: public read" on public.shared_places
  for select to anon, authenticated using (true);

-- Tworzyc / odswiezac moze tylko autor migawki.
drop policy if exists "shared_places: owner insert" on public.shared_places;
create policy "shared_places: owner insert" on public.shared_places
  for insert to authenticated with check (auth.uid() = shared_by);
drop policy if exists "shared_places: owner update" on public.shared_places;
create policy "shared_places: owner update" on public.shared_places
  for update to authenticated using (auth.uid() = shared_by) with check (auth.uid() = shared_by);

grant select on public.shared_places to anon, authenticated;
grant insert, update on public.shared_places to authenticated;
