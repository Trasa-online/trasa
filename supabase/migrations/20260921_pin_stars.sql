-- Gwiazdka („wyroznienie") przy miejscu w PLANIE per UCZESTNIK (zgloszenie Nat 2026-09-21).
--
-- Do tej pory gwiazdka w planie zyla w `pins.is_top` = JEDNA na miejsce, wspolna dla wszystkich.
-- RLS `Group members can update pins of shared route` przepuszczala uczestnika, wiec jego
-- gwiazdka LADOWALA NA PROFILU WLASCICIELA (licznik „Wyroznione" czyta piny po `routes.user_id`),
-- a na jego wlasnym profilu nie bylo jej wcale. Kolekcje maja to od 2026-09-20 rozwiazane
-- tabela `discovery_item_stars` - tu lustro tej samej konstrukcji.
--
-- `pins.is_top` ZOSTAJE i znaczy „gwiazdka WLASCICIELA planu": czyta je strona linku i gosc
-- (kto nie jest w planie, widzi jedna gwiazdke - autora). Trigger trzyma je w zgodzie z tabela
-- gwiazdek, a klient (takze wlasciciel) pisze juz TYLKO do tabeli.

create table if not exists public.pin_stars (
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  place_name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists pin_stars_unique on public.pin_stars (route_id, user_id, public.place_note_key(place_name));
create index if not exists pin_stars_route_idx on public.pin_stars (route_id);
create index if not exists pin_stars_user_idx on public.pin_stars (user_id);

alter table public.pin_stars enable row level security;

-- Kto jest W planie: wlasciciel albo czlonek sesji grupowej (kazdy status - tak samo, jak
-- polityki na `pins`). Uzywane w politykach ponizej, wiec EXECUTE musi miec kazda rola,
-- ktora czyta tabele (regula z migracji 20260916b).
create or replace function public.is_route_participant(p_route uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.routes r
     where r.id = p_route
       and r.deleted_at is null
       and (
         r.user_id = p_user
         or (r.group_session_id is not null and exists (
           select 1 from public.group_session_members m
            where m.session_id = r.group_session_id and m.user_id = p_user))
       )
  );
$$;
revoke execute on function public.is_route_participant(uuid, uuid) from public;
grant execute on function public.is_route_participant(uuid, uuid) to anon, authenticated;

-- Odczyt: uczestnicy planu zawsze; reszta swiata - wylacznie plan OPUBLIKOWANY
-- (`is_shared` samo NIE znaczy „opublikowany", patrz migracja 20260916c).
drop policy if exists pin_stars_read on public.pin_stars;
create policy pin_stars_read on public.pin_stars for select
  using (
    public.is_route_participant(route_id, auth.uid())
    or exists (
      select 1 from public.routes r
       where r.id = pin_stars.route_id
         and r.deleted_at is null
         and r.is_shared = true
         and r.status = 'published'
    )
  );

drop policy if exists pin_stars_own_insert on public.pin_stars;
create policy pin_stars_own_insert on public.pin_stars for insert
  with check (
    auth.uid() is not null and user_id = auth.uid()
    and public.is_route_participant(route_id, auth.uid())
  );

drop policy if exists pin_stars_own_delete on public.pin_stars;
create policy pin_stars_own_delete on public.pin_stars for delete
  using (auth.uid() is not null and user_id = auth.uid());

grant select, insert, delete on public.pin_stars to authenticated;
grant select on public.pin_stars to anon;

-- is_top = „wlasciciel wyroznil". Statement-level po zmianie w tabeli gwiazdek; dwie funkcje,
-- bo transition table wymieniona w ciele MUSI istniec w tym wywolaniu (INSERT nie ma OLD,
-- DELETE nie ma NEW - ta sama pulapka, co przy kolekcjach).
create or replace function public.resync_pin_top(p_route uuid, p_place text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pins p
     set is_top = exists (
       select 1 from public.pin_stars st
         join public.routes r on r.id = st.route_id
        where st.route_id = p.route_id
          and st.user_id = r.user_id
          and public.place_note_key(st.place_name) = public.place_note_key(p.place_name)
     )
   where p.route_id = p_route
     and public.place_note_key(p.place_name) = public.place_note_key(p_place);
$$;
revoke execute on function public.resync_pin_top(uuid, text) from public, anon, authenticated;

create or replace function public.sync_pin_top_from_stars_ins()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct s.route_id, s.place_name from new_rows s loop
    perform public.resync_pin_top(r.route_id, r.place_name);
  end loop;
  return null;
end; $$;
create or replace function public.sync_pin_top_from_stars_del()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct s.route_id, s.place_name from old_rows s loop
    perform public.resync_pin_top(r.route_id, r.place_name);
  end loop;
  return null;
end; $$;
revoke execute on function public.sync_pin_top_from_stars_ins() from public, anon, authenticated;
revoke execute on function public.sync_pin_top_from_stars_del() from public, anon, authenticated;

drop trigger if exists trg_pin_stars_sync_top_ins on public.pin_stars;
create trigger trg_pin_stars_sync_top_ins
  after insert on public.pin_stars
  referencing new table as new_rows
  for each statement execute function public.sync_pin_top_from_stars_ins();
drop trigger if exists trg_pin_stars_sync_top_del on public.pin_stars;
create trigger trg_pin_stars_sync_top_del
  after delete on public.pin_stars
  referencing old table as old_rows
  for each statement execute function public.sync_pin_top_from_stars_del();

-- Backfill: dotychczasowe gwiazdki przypisujemy WLASCICIELOWI planu. Nie wiemy, kto je
-- postawil (pin tego nie trzyma) - a tak dotad liczyl je profil, wiec nikomu nic nie ubywa.
insert into public.pin_stars (route_id, user_id, place_name)
select p.route_id, r.user_id, p.place_name
  from public.pins p
  join public.routes r on r.id = p.route_id
 where p.is_top = true
   and r.user_id is not null
   and coalesce(btrim(p.place_name), '') <> ''
on conflict do nothing;

-- Licznik „Wyroznione przez N osob" na wizytowce premium: liczy OSOBY z obu tabel gwiazdek
-- (do tej pory po `is_top`, czyli wylacznie wlascicieli). Nadal TYLKO tresc publiczna.
create or replace function public.place_star_count(p_name text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  with k as (select public.place_note_key(p_name) as key)
  select count(*)::int from (
    select distinct st.user_id
      from public.pin_stars st
      join public.routes r on r.id = st.route_id
     where r.deleted_at is null
       and r.status = 'published'
       and public.place_note_key(st.place_name) = (select key from k)
       and (select key from k) <> ''
    union
    select distinct st.user_id
      from public.discovery_item_stars st
      join public.discovery_collections c on c.id = st.collection_id
     where c.deleted_at is null
       and c.is_public
       and coalesce(c.hidden_by_admin, false) = false
       and c.moderation_status <> 'rejected'
       and public.place_note_key(st.place_name) = (select key from k)
       and (select key from k) <> ''
  ) osoby;
$function$;
revoke execute on function public.place_star_count(text) from public;
grant  execute on function public.place_star_count(text) to authenticated, anon;
