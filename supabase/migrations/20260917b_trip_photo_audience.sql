-- ZDJECIA W WYJEZDZIE: PUBLICZNE albo TYLKO DLA ZNAJOMYCH (prosba Nat 2026-09-17).
--
-- Galeria wyjazdu sklada sie z DWOCH zrodel (SharedRoute laczy je przy wyswietlaniu):
--   * `routes.review_photos`  - text[] na trasie, zdjecia wgrane wprost do galerii (owner-only),
--   * `pin_photos`            - wiersze, zdjecia dodane przy KONKRETNYM MIEJSCU (kazdy uczestnik).
-- Trzecie zrodlo, `group_trip_photos`, zyje w podsumowaniu i w eksploracji, nie w tej galerii.
--
-- ⛔ BRAMKA MUSI BYC W BAZIE, NIE W KLIENCIE. `review_photos` to kolumna tablicowa na `routes`:
-- RLS filtruje WIERSZE, nie elementy tablicy, wiec kto moze przeczytac trase, ten czyta WSZYSTKIE
-- adresy w tej tablicy. Zdjecie "tylko dla znajomych" nie moze wiec w niej zostac - i dlatego
-- dostaje wlasna TABELE. `pin_photos` sa juz wierszami, wiec tam wystarczy kolumna.
--
-- Konsekwencja projektowa (celowa): `routes.review_photos` staje sie z definicji tablica zdjec
-- PUBLICZNYCH. Dzieki temu ~40 miejsc w kodzie, ktore ja dzis czytaja (okladka hero, strona
-- linku, podsumowanie, przypomnienia, migawka przy usunieciu hosta), dziala BEZ ZMIAN i z
-- gruntu nie moze pokazac zdjecia prywatnego. Zadnej migracji danych, zadnego refaktoru.

-- ── 1. Zdjecia przy miejscu ────────────────────────────────────────────────────
alter table public.pin_photos
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pin_photos_visibility_check') then
    alter table public.pin_photos
      add constraint pin_photos_visibility_check check (visibility in ('public', 'friends'));
  end if;
end $$;

-- ── 2. Zdjecia galerii wyjazdu tylko dla znajomych ─────────────────────────────
-- Sama OBECNOSC wiersza w tej tabeli jest widocznoscia - nie ma tu kolumny `visibility`,
-- bo zdjecie publiczne z definicji lezy w tablicy na trasie, a nie tutaj.
create table if not exists public.route_friend_photos (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  url        text not null,
  -- Pozycja, na ktorej zdjecie stalo w `review_photos`. Trzymamy ja, zeby przelaczenie
  -- z powrotem na publiczne wstawilo je TAM, GDZIE BYLO, a nie na koniec galerii.
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists route_friend_photos_route_idx on public.route_friend_photos(route_id);
alter table public.route_friend_photos enable row level security;

-- ── 3. Klucz pliku ─────────────────────────────────────────────────────────────
-- Ten sam plik bywa zapisany raz przez api.spontaway.com, a raz przez <ref>.supabase.co
-- (dwie domeny tego samego Storage), wiec porownanie calych adresow gubi trafienia.
-- Odpowiednik `storageKey()` z SharedRoute.tsx - zmieniasz jedno, zmien drugie.
create or replace function public.trip_photo_key(p_url text)
returns text language sql immutable
as $$
  select regexp_replace(split_part(coalesce(p_url, ''), '?', 1), '^.*/route-images/', '');
$$;

-- ── 4. Kto widzi co ────────────────────────────────────────────────────────────
-- ⚠️ DECYZJA: "tylko dla znajomych" bramkuje SWIAT ZEWNETRZNY, a nie ludzi WEWNATRZ wyjazdu.
-- Wlasciciel i uczestnicy widza w swoim wspolnym wyjezdzie wszystko. Inaczej wlasciciel mialby
-- we wlasnym wyjezdzie tresc, ktorej nie widzi, a ktora wolno mu skasowac (polityka DELETE) -
-- i to jest niespojnosc, nie prywatnosc. Zdjecie chowa sie wiec przed publicznoscia, nie przed
-- osobami, ktore i tak tam byly.
--
-- ⚠️ Przy okazji NAPRAWIONY PRZECIEK. Dotychczasowe `r.is_shared = true` wpuszczalo KAZDEGO
-- zalogowanego, bo `is_shared` nie znaczy "opublikowany": `inviteUsersToRoute` ustawia je
-- kazdemu wyjazdowi grupowemu, takze roboczemu. To ta sama klasa bledu, ktora naprawila
-- migracja 20260916c na `routes` - tylko ze na tabeli zdjec zostala. Zmierzone na prodzie
-- przed naprawa: 22 zdjecia z 1 nieopublikowanego wyjazdu czytelne dla kazdego zalogowanego.
-- Uczestnicy NIC nie traca: dochodzi jawny warunek czlonkostwa w sesji grupowej.
drop policy if exists "read pin photos" on public.pin_photos;
create policy "read pin photos" on public.pin_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = pin_photos.route_id
        and r.deleted_at is null
        and (
          r.user_id = auth.uid()
          or pin_photos.user_id = auth.uid()
          or (r.group_session_id is not null and r.group_session_id in (
                select m.session_id from public.group_session_members m where m.user_id = auth.uid()))
          or (r.is_shared and r.status = 'published' and (
                pin_photos.visibility = 'public'
                or public.are_friends(pin_photos.user_id, auth.uid())))
        )
    )
  );

drop policy if exists "rfp_select" on public.route_friend_photos;
create policy "rfp_select" on public.route_friend_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_friend_photos.route_id
        and r.deleted_at is null
        and (
          r.user_id = auth.uid()
          or route_friend_photos.user_id = auth.uid()
          or (r.group_session_id is not null and r.group_session_id in (
                select m.session_id from public.group_session_members m where m.user_id = auth.uid()))
          or (r.is_shared and r.status = 'published'
              and public.are_friends(route_friend_photos.user_id, auth.uid()))
        )
    )
  );

-- Kasowanie zdjecia z galerii: autor albo wlasciciel wyjazdu (jak przy `pin_photos`).
-- ⛔ Wstawiania NIE ma - wiersz powstaje wylacznie przez `set_trip_photo_audience`, zeby
-- zdjecie nie mogla znalezc sie w obu zrodlach naraz.
drop policy if exists "rfp_delete" on public.route_friend_photos;
create policy "rfp_delete" on public.route_friend_photos
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.routes r where r.id = route_friend_photos.route_id and r.user_id = auth.uid())
  );

-- Ta sama luka `is_shared` na wspolnych zdjeciach sesji. Dzis dotyczy 0 zdjec (sprawdzone),
-- ale zostawiona byla by mina na pierwszy grupowy szkic ze zdjeciami.
drop policy if exists "gtp_select" on public.group_trip_photos;
create policy "gtp_select" on public.group_trip_photos
  for select to authenticated
  using (
    public.is_group_session_member(session_id)
    or exists (
      select 1 from public.routes r
      where r.group_session_id = group_trip_photos.session_id
        and r.is_shared and r.status = 'published' and r.deleted_at is null
    )
  );

-- ── 5. Przelacznik ─────────────────────────────────────────────────────────────
-- JEDNO wejscie dla obu zrodel, zeby galeria nie musiala wiedziec, skad pochodzi zdjecie.
create or replace function public.set_trip_photo_audience(p_route uuid, p_url text, p_friends boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_key   text := public.trip_photo_key(p_url);
  v_pin   public.pin_photos%rowtype;
  v_row   public.route_friend_photos%rowtype;
  v_arr   text[];
  v_idx   int;
  v_out   text := case when p_friends then 'friends' else 'public' end;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select user_id into v_owner from public.routes where id = p_route and deleted_at is null;
  if v_owner is null then raise exception 'route not found'; end if;

  -- (a) zdjecie przy MIEJSCU - flaguje jego autor albo wlasciciel wyjazdu
  -- ⛔ NIE uzywaj tu `found`. W plpgsql KAZDY kolejny SELECT INTO je nadpisuje, a nizej
  -- czytamy jeszcze `review_photos` - ten odczyt ZAWSZE zwraca wiersz, wiec `found` robilo
  -- sie true i funkcja wychodzila przed zapisem, zwracajac 'friends' bez zadnego skutku.
  -- Zlapane testem na prodzie (zdjecie "przelaczone", a galeria bez zmian). Sprawdzamy
  -- wprost, czy rekord sie wypelnil.
  select * into v_pin from public.pin_photos
   where route_id = p_route and public.trip_photo_key(url) = v_key limit 1;
  if v_pin.id is not null then
    if v_pin.user_id is distinct from v_uid and v_owner is distinct from v_uid then
      raise exception 'not allowed';
    end if;
    update public.pin_photos set visibility = v_out where id = v_pin.id;
    return v_out;
  end if;

  -- (b) zdjecie GALERII WYJAZDU - tylko wlasciciel, bo `review_photos` jest owner-only
  if v_owner is distinct from v_uid then raise exception 'not allowed'; end if;

  select * into v_row from public.route_friend_photos
   where route_id = p_route and public.trip_photo_key(url) = v_key limit 1;
  select review_photos into v_arr from public.routes where id = p_route;
  v_arr := coalesce(v_arr, '{}');

  if p_friends then
    if v_row.id is not null then return 'friends'; end if;
    select i into v_idx from unnest(v_arr) with ordinality t(u, i)
     where public.trip_photo_key(u) = v_key limit 1;
    if v_idx is null then raise exception 'photo not in trip gallery'; end if;
    insert into public.route_friend_photos (route_id, user_id, url, sort_order)
      values (p_route, v_uid, v_arr[v_idx], v_idx);
    update public.routes set review_photos = v_arr[1:v_idx-1] || v_arr[v_idx+1:] where id = p_route;
    return 'friends';
  else
    if v_row.id is null then return 'public'; end if;
    -- Wraca na SWOJE miejsce; gdy galeria zdazyla sie skrocic, laduje na koncu.
    v_idx := least(greatest(v_row.sort_order, 1), coalesce(array_length(v_arr, 1), 0) + 1);
    update public.routes
       set review_photos = v_arr[1:v_idx-1] || array[v_row.url] || v_arr[v_idx:]
     where id = p_route;
    delete from public.route_friend_photos where id = v_row.id;
    return 'public';
  end if;
end;
$$;

revoke execute on function public.set_trip_photo_audience(uuid, text, boolean) from public, anon;
revoke execute on function public.trip_photo_key(text) from public, anon;
grant execute on function public.set_trip_photo_audience(uuid, text, boolean) to authenticated;
grant execute on function public.trip_photo_key(text) to authenticated;
