-- Gwiazdka („wyroznienie") przy miejscu w kolekcji PER UCZESTNIK (prosba Nat 2026-09-20).
-- Do tej pory gwiazdka zyla w `discovery_items.is_top` = jedna na pozycje, a RLS pozwala
-- wspoltworcy edytowac wylacznie SWOJE pozycje - wiec uczestnik nie mogl wyroznic niczego.
-- Lustro `discovery_item_notes` / `place_visits`: jeden wiersz na (kolekcja, user, miejsce).
--
-- `discovery_items.is_top` ZOSTAJE i znaczy „gwiazdka WLASCICIELA" - czyta ja profil
-- (licznik „Wyroznione"), `place_star_count` na wizytowce i kafelki. Trigger trzyma je
-- w zgodzie z tabela gwiazdek, a klient pisze juz TYLKO do tabeli (takze wlasciciel).

create table if not exists public.discovery_item_stars (
  collection_id uuid not null references public.discovery_collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_name    text not null,
  created_at    timestamptz not null default now()
);
create unique index if not exists dis_unique on public.discovery_item_stars (collection_id, user_id, public.place_note_key(place_name));
create index if not exists dis_collection_idx on public.discovery_item_stars (collection_id);

alter table public.discovery_item_stars enable row level security;

drop policy if exists dis_read on public.discovery_item_stars;
create policy dis_read on public.discovery_item_stars for select
  using (public.can_read_collection(collection_id, auth.uid()));

drop policy if exists dis_own_insert on public.discovery_item_stars;
create policy dis_own_insert on public.discovery_item_stars for insert
  with check (
    auth.uid() is not null and user_id = auth.uid()
    and (public.is_collection_owner(collection_id, auth.uid()) or public.is_collection_member(collection_id, auth.uid()))
  );

drop policy if exists dis_own_delete on public.discovery_item_stars;
create policy dis_own_delete on public.discovery_item_stars for delete
  using (auth.uid() is not null and user_id = auth.uid());

grant select, insert, delete on public.discovery_item_stars to authenticated;
grant select on public.discovery_item_stars to anon;

-- is_top = „wlasciciel wyroznil". Statement-level, po zmianie w tabeli gwiazdek.
-- Dwie funkcje, bo transition table wymieniona w ciele MUSI istniec w tym wywolaniu -
-- INSERT nie ma OLD, DELETE nie ma NEW (pierwsza wersja z jedna funkcja i `tg_op` padla
-- na "relation old_rows does not exist" przy pierwszym insercie).
create or replace function public.resync_item_top(p_collection uuid, p_place text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.discovery_items i
     set is_top = exists (
       select 1 from public.discovery_item_stars st
         join public.discovery_collections c on c.id = st.collection_id
        where st.collection_id = i.collection_id
          and st.user_id = c.user_id
          and public.place_note_key(st.place_name) = public.place_note_key(i.place_name)
     )
   where i.collection_id = p_collection
     and public.place_note_key(i.place_name) = public.place_note_key(p_place);
$$;
revoke execute on function public.resync_item_top(uuid, text) from public, anon, authenticated;

create or replace function public.sync_item_top_from_stars_ins()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct s.collection_id, s.place_name from new_rows s loop
    perform public.resync_item_top(r.collection_id, r.place_name);
  end loop;
  return null;
end; $$;
create or replace function public.sync_item_top_from_stars_del()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct s.collection_id, s.place_name from old_rows s loop
    perform public.resync_item_top(r.collection_id, r.place_name);
  end loop;
  return null;
end; $$;
revoke execute on function public.sync_item_top_from_stars_ins() from public, anon, authenticated;
revoke execute on function public.sync_item_top_from_stars_del() from public, anon, authenticated;

drop trigger if exists trg_dis_sync_top_ins on public.discovery_item_stars;
create trigger trg_dis_sync_top_ins
  after insert on public.discovery_item_stars
  referencing new table as new_rows
  for each statement execute function public.sync_item_top_from_stars_ins();
drop trigger if exists trg_dis_sync_top_del on public.discovery_item_stars;
create trigger trg_dis_sync_top_del
  after delete on public.discovery_item_stars
  referencing old table as old_rows
  for each statement execute function public.sync_item_top_from_stars_del();

-- Backfill: dotychczasowe gwiazdki wlascicieli.
insert into public.discovery_item_stars (collection_id, user_id, place_name)
select i.collection_id, c.user_id, i.place_name
  from public.discovery_items i
  join public.discovery_collections c on c.id = i.collection_id
 where i.is_top = true
on conflict do nothing;

drop function if exists public.sync_item_top_from_stars();
