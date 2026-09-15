-- WLASNA OKLADKA WYJAZDU DLA KAZDEGO UCZESTNIKA (prosba Nat 2026-08-31).
-- Kontekst: wspolny wyjazd ma jedna okladke ustawiana przez hosta (routes.list_cover_url) i to
-- ona reprezentuje wyjazd w EKSPLORACJI. Uczestnik chce widziec u siebie SWOJE zdjecie -
-- wybor jednego nie moze zmieniac widoku pozostalych.
--
-- Model: wiersz na (route_id, user_id). Brak wiersza = pokazujemy okladke hosta (fallback).
-- Eksploracja NIGDY nie czyta tej tabeli - tam zawsze leci okladka hosta.
create table if not exists public.route_member_covers (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cover_url text not null,
  updated_at timestamptz not null default now(),
  primary key (route_id, user_id)
);

alter table public.route_member_covers enable row level security;

-- Kazdy zarzadza WYLACZNIE swoja okladka...
drop policy if exists "Users manage own route cover" on public.route_member_covers;
create policy "Users manage own route cover" on public.route_member_covers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ...ale WIDZI okladki wspoluczestnikow tego samego wyjazdu (profil pokazuje karte wyjazdu
-- tak, jak widzi ja jej wlasciciel).
drop policy if exists "Members read covers of shared routes" on public.route_member_covers;
create policy "Members read covers of shared routes" on public.route_member_covers
  for select to authenticated using (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and (r.user_id = auth.uid()
             or (r.group_session_id is not null and public.is_group_session_member(r.group_session_id))
             or (r.is_shared and coalesce(r.status, 'draft') = 'published'))
    )
  );
