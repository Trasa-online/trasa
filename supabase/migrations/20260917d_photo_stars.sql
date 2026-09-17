-- WYROZNIENIE ZDJECIA GWIAZDKA - BUDZET 3 NA WYJAZD (decyzja Nat 2026-09-17).
--
-- Obok serca (polubienie, bez limitu) ogladajacy moze WYROZNIC zdjecia w galerii wyjazdu.
-- Gwiazdka zostaje BINARNA - tak jak wszedzie indziej w apce ("topka" przy miejscu) - ale
-- kazdy ma ich tylko TRZY na jeden wyjazd. Niedobor jest tu cala mechanika: bez niego
-- gwiazdka bylaby drugim polubieniem i przestalaby cokolwiek znaczyc.
--
-- ⛔ Swiadomie NIE robimy skali 1-3 na jednym zdjeciu. Dwa powody: gwiazdka dostalaby
-- w produkcie DRUGIE znaczenie obok binarnej "topki", a skala czytalaby sie jak ocena -
-- czyli dokladnie to, czego produkt unika (CLAUDE.md: zakaz ocen gwiazdkowych miejsc).
--
-- ⚠️ `route_id` jest w kluczu, bo budzet liczy sie NA WYJAZD. `photo_likes` go nie ma
-- (tam limitu nie ma), wiec to nie jest niespojnosc, tylko inna potrzeba.

create table if not exists public.photo_stars (
  route_id   uuid not null references public.routes(id) on delete cascade,
  photo_ref  text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, photo_ref, user_id)
);

create index if not exists photo_stars_route_idx on public.photo_stars(route_id);
alter table public.photo_stars enable row level security;

-- Odczyt publiczny, jak przy `photo_likes`: licznik wyroznien jest informacja jawna,
-- a autor ma go widziec bez zadnego dodatkowego uprawnienia.
drop policy if exists "photo_stars_public_read" on public.photo_stars;
create policy "photo_stars_public_read" on public.photo_stars for select using (true);

drop policy if exists "photo_stars_owner_insert" on public.photo_stars;
create policy "photo_stars_owner_insert" on public.photo_stars
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "photo_stars_owner_delete" on public.photo_stars;
create policy "photo_stars_owner_delete" on public.photo_stars
  for delete to authenticated using (auth.uid() = user_id);

-- ── Straznik ───────────────────────────────────────────────────────────────────
-- Dwie reguly w jednym miejscu, bo obie dotycza tego samego zapisu:
--   1. autor i uczestnik NIE wyrozniaja wlasnego wyjazdu - ta sama zasada, co przy sercu
--      (`guard_like_not_own_trip`): skoro nie mozesz polubic swojego wyjazdu, nie mozesz
--      tez przyznawac sobie wyroznien;
--   2. budzet 3 na (wyjazd, user).
-- ⚠️ Limit stoi w BAZIE, nie tylko w UI. Klient zna stan galerii, ktora ma otwarta - a user
-- moze miec wyjazd otwarty na dwoch urzadzeniach i wyklikac szesc gwiazdek, zanim ktorykolwiek
-- ekran sie odswiezy.
create or replace function public.guard_photo_star()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  if exists (
    select 1 from public.routes r
    where r.id = NEW.route_id
      and (
        r.user_id = NEW.user_id
        or (r.group_session_id is not null and exists (
              select 1 from public.group_session_members m
              where m.session_id = r.group_session_id and m.user_id = NEW.user_id))
      )
  ) then
    raise exception 'own_trip_star' using errcode = '42501';
  end if;

  select count(*) into v_used from public.photo_stars
   where route_id = NEW.route_id and user_id = NEW.user_id;
  if v_used >= 3 then
    raise exception 'star_budget' using errcode = '42501';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_photo_stars_guard on public.photo_stars;
create trigger trg_photo_stars_guard
  before insert on public.photo_stars
  for each row execute function public.guard_photo_star();

revoke execute on function public.guard_photo_star() from public, anon, authenticated;
