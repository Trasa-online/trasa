-- JEDNA notka usera o miejscu - WSZEDZIE (decyzja Nat 2026-09-13).
--
-- Dotad notka zyla per WIERSZ: osobno w kazdej kolekcji (discovery_items.short_desc) i osobno
-- w kazdym wyjezdzie (pin_ratings.note). To samo miejsce dodane do dwoch kolekcji i wyjazdu
-- mialo trzy niezalezne notki, a wizytowka miejsca ("Od uzytkownikow") pokazywala je jako trzy
-- wpisy tej samej osoby. Teraz notka jest JEDNA na (user, miejsce): zapis w dowolnym miejscu
-- rozchodzi sie na wszystkie wiersze tego usera z tym miejscem, a nowo dodane miejsce dostaje
-- istniejaca notke od razu.
--
-- Tozsamosc miejsca = ZNORMALIZOWANA NAZWA (lower/trim) - ta sama regula, co przy zdjeciach
-- (place_photos 'nm:<nazwa>') i notkach na wizytowce (notesByPlace). Tabele NIE zmieniaja
-- ksztaltu (widoki czytaja swoje kolumny jak dotad) - synchronizuja je triggery.
--
-- Zakres rozchodzenia: kolekcje usera (wszystkie, takze prywatna "Ogolne") + wiersze
-- pin_ratings usera w kazdym wyjezdzie + WYJAZDY USERA (routes.user_id), w ktorych to miejsce
-- jest, a wiersza notki jeszcze nie ma (wtedy wiersz powstaje). Uczestnik cudzego wyjazdu
-- dostaje tam swoja notke dopiero, gdy sam cos w nim napisze albo dodal to miejsce (added_by).

create or replace function public.place_note_key(p_name text)
returns text
language sql
immutable
as $$ select lower(trim(coalesce(p_name, ''))) $$;

create index if not exists discovery_items_note_key_idx on public.discovery_items (public.place_note_key(place_name));
create index if not exists pin_ratings_note_key_idx on public.pin_ratings (user_id, public.place_note_key(place_name));
create index if not exists pins_note_key_idx on public.pins (public.place_note_key(place_name));

-- Istniejaca notka usera o miejscu (dowolne zrodlo). NULL = user nic o nim nie napisal.
create or replace function public.find_place_note(p_user uuid, p_name text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select n from (
    select nullif(trim(di.short_desc), '') as n
      from public.discovery_items di
      join public.discovery_collections c on c.id = di.collection_id
     where c.user_id = p_user and public.place_note_key(di.place_name) = public.place_note_key(p_name)
    union all
    select nullif(trim(pr.note), '')
      from public.pin_ratings pr
     where pr.user_id = p_user and public.place_note_key(pr.place_name) = public.place_note_key(p_name)
  ) s
  where n is not null
  limit 1
$$;

-- Rozejscie notki na wszystkie wiersze usera z tym miejscem. Flaga trasa.note_sync (lokalna dla
-- transakcji) wycisza triggery na czas tych zapisow - inaczej kazdy update odpalalby kolejne
-- rozejscie tej samej notki.
create or replace function public.propagate_place_note(p_user uuid, p_name text, p_note text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key  text := public.place_note_key(p_name);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_user is null or v_key = '' then return; end if;
  perform set_config('trasa.note_sync', '1', true);

  update public.discovery_items di
     set short_desc = v_note
    from public.discovery_collections c
   where c.id = di.collection_id
     and c.user_id = p_user
     and public.place_note_key(di.place_name) = v_key
     and di.short_desc is distinct from v_note;

  update public.pin_ratings pr
     set note = v_note
   where pr.user_id = p_user
     and public.place_note_key(pr.place_name) = v_key
     and pr.note is distinct from v_note;

  -- Wyjazdy USERA z tym miejscem, w ktorych nie ma jeszcze jego wiersza notki.
  if v_note is not null then
    insert into public.pin_ratings (route_id, user_id, place_name, note)
    select distinct on (p.route_id, public.place_note_key(p.place_name)) p.route_id, p_user, p.place_name, v_note
      from public.pins p
      join public.routes r on r.id = p.route_id
     where r.user_id = p_user
       and public.place_note_key(p.place_name) = v_key
       and not exists (
         select 1 from public.pin_ratings x
          where x.route_id = p.route_id and x.user_id = p_user
            and public.place_note_key(x.place_name) = v_key)
    on conflict (route_id, user_id, place_name) do update set note = excluded.note;
  end if;

  perform set_config('trasa.note_sync', '', true);
end; $$;

-- ── Kolekcje: pozycja dostaje istniejaca notke przy dodaniu, a zmiana notki sie rozchodzi ──
create or replace function public.list_item_note_prefill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_note text;
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if nullif(trim(coalesce(new.short_desc, '')), '') is not null then return new; end if;
  select c.user_id into v_owner from public.discovery_collections c where c.id = new.collection_id;
  if v_owner is null then return new; end if;
  v_note := public.find_place_note(v_owner, new.place_name);
  if v_note is not null then new.short_desc := v_note; end if;
  return new;
end; $$;

create or replace function public.list_item_note_propagate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid;
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' and new.short_desc is not distinct from old.short_desc then return new; end if;
  -- INSERT bez notki: prefill juz ja wpisal (albo user nic nie ma) - nie ma czego rozsylac.
  if tg_op = 'INSERT' and nullif(trim(coalesce(new.short_desc, '')), '') is null then return new; end if;
  select c.user_id into v_owner from public.discovery_collections c where c.id = new.collection_id;
  if v_owner is null then return new; end if;
  perform public.propagate_place_note(v_owner, new.place_name, new.short_desc);
  return new;
end; $$;

drop trigger if exists trg_list_item_note_prefill on public.discovery_items;
create trigger trg_list_item_note_prefill
  before insert on public.discovery_items
  for each row execute function public.list_item_note_prefill();

drop trigger if exists trg_list_item_note_propagate on public.discovery_items;
create trigger trg_list_item_note_propagate
  after insert or update of short_desc on public.discovery_items
  for each row execute function public.list_item_note_propagate();

-- ── Wyjazdy: wiersz notki uczestnika ─────────────────────────────────────────
create or replace function public.pin_rating_note_prefill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_note text;
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if nullif(trim(coalesce(new.note, '')), '') is not null then return new; end if;
  v_note := public.find_place_note(new.user_id, new.place_name);
  if v_note is not null then new.note := v_note; end if;
  return new;
end; $$;

create or replace function public.pin_rating_note_propagate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' and new.note is not distinct from old.note then return new; end if;
  if tg_op = 'INSERT' and nullif(trim(coalesce(new.note, '')), '') is null then return new; end if;
  perform public.propagate_place_note(new.user_id, new.place_name, new.note);
  return new;
end; $$;

drop trigger if exists trg_pin_rating_note_prefill on public.pin_ratings;
create trigger trg_pin_rating_note_prefill
  before insert on public.pin_ratings
  for each row execute function public.pin_rating_note_prefill();

drop trigger if exists trg_pin_rating_note_propagate on public.pin_ratings;
create trigger trg_pin_rating_note_propagate
  after insert or update of note on public.pin_ratings
  for each row execute function public.pin_rating_note_propagate();

-- ── Wyjazdy: miejsce dodane do wyjazdu dostaje notke osoby, ktora je dodala ──
-- pin_ratings powstaje leniwie (dopiero przy pisaniu), wiec bez tego kroku wyjazd nie
-- pokazywalby notki, ktora user ma juz w kolekcji. replace_route_pins wstawia piny od nowa
-- przy kazdej edycji - wtedy wiersz juz istnieje i ON CONFLICT nic nie nadpisuje.
create or replace function public.pin_note_prefill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_user uuid; v_note text;
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if coalesce(trim(new.place_name), '') = '' then return new; end if;
  select coalesce(new.added_by, r.user_id) into v_user from public.routes r where r.id = new.route_id;
  if v_user is null then return new; end if;
  v_note := public.find_place_note(v_user, new.place_name);
  if v_note is null then return new; end if;
  perform set_config('trasa.note_sync', '1', true);
  insert into public.pin_ratings (route_id, user_id, place_name, note)
  values (new.route_id, v_user, new.place_name, v_note)
  on conflict (route_id, user_id, place_name) do update set note = coalesce(pin_ratings.note, excluded.note);
  perform set_config('trasa.note_sync', '', true);
  return new;
end; $$;

drop trigger if exists trg_pin_note_prefill on public.pins;
create trigger trg_pin_note_prefill
  after insert on public.pins
  for each row execute function public.pin_note_prefill();

-- ── Backfill: scalenie istniejacych notek ────────────────────────────────────
-- Przy KONFLIKCIE (rozne notki o tym samym miejscu) wygrywa notka z KOLEKCJI (publiczna
-- polecajka, pisana swiadomie), potem dluzsza. Stan przed migracja: 113 par (user, miejsce)
-- z notka, 5 konfliktow (4 u Nat).
do $$
declare r record;
begin
  for r in
    with n as (
      select c.user_id, public.place_note_key(di.place_name) as k, di.place_name,
             nullif(trim(di.short_desc), '') as note, 0 as pri
        from public.discovery_items di
        join public.discovery_collections c on c.id = di.collection_id
      union all
      select pr.user_id, public.place_note_key(pr.place_name), pr.place_name,
             nullif(trim(pr.note), ''), 1
        from public.pin_ratings pr
    )
    select distinct on (user_id, k) user_id, place_name, note
      from n
     where note is not null and user_id is not null and k <> ''
     order by user_id, k, pri, length(note) desc
  loop
    perform public.propagate_place_note(r.user_id, r.place_name, r.note);
  end loop;
end $$;
