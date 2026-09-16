-- ZDJECIA MIEJSCA IDA ZA MIEJSCEM, nie za kolekcja (zgloszenie testerki 2026-09-16:
-- "notatki i zdjecia dla miejsc nie przenosza sie miedzy kolekcjami miejsc").
--
-- Notatki dzialaly juz tak od 2026-09-13 (`propagate_place_note`): notka to JEDNA rzecz na
-- pare (user, miejsce) i widac ja wszedzie. Zdjecia zostaly per-kolekcja i przez to ta sama
-- kawiarnia miala moje zdjecie w jednej kolekcji, a pustke w drugiej. Testerka zglosila oba
-- naraz, bo z jej strony to jedno zachowanie: "to, co dodalam do miejsca, ma byc przy miejscu".
--
-- Robimy to LUSTREM notatek, zeby dwa mechanizmy nie zyly wlasnym zyciem:
--   * zdjecie dodane przy miejscu rozchodzi sie na WSZYSTKIE kolekcje tego usera (wlasne
--     i wspoltworzone), ktore maja to miejsce,
--   * usuniecie zdjecia zabiera je z tych samych miejsc,
--   * nowa pozycja w kolekcji dostaje istniejace zdjecia od razu (prefill - jak przy notce).
--
-- ⚠️ Rozchodzi sie WYLACZNIE wlasne zdjecie (`user_id`). Cudzych nie kopiujemy nigdzie:
-- wspoltworca wrzuca zdjecie do TEJ kolekcji i tylko autor decyduje, gdzie jeszcze jest.
-- ⚠️ Tozsamosc miejsca = `place_note_key` (lower/trim nazwy) - ta sama regula, co przy notkach.
-- Rekurencje wycisza flaga transakcyjna `trasa.photo_sync`, dokladnie jak `trasa.note_sync`.

-- Bez tego `on conflict do nothing` nie ma na czym pracowac i lustro dorzucaloby duble.
-- Sprawdzone przed zalozeniem: 0 istniejacych duplikatow.
create unique index if not exists dip_unique_place_url
  on public.discovery_item_photos (collection_id, public.place_note_key(place_name), url);

create or replace function public.discovery_item_photo_spread()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_key text := public.place_note_key(new.place_name);
begin
  if coalesce(current_setting('trasa.photo_sync', true), '') = '1' then return new; end if;
  if v_key = '' or new.user_id is null then return new; end if;
  perform set_config('trasa.photo_sync', '1', true);

  insert into public.discovery_item_photos (collection_id, place_name, user_id, url)
  select distinct di.collection_id, di.place_name, new.user_id, new.url
    from public.discovery_items di
    join public.discovery_collections c on c.id = di.collection_id
   where c.deleted_at is null
     and di.collection_id <> new.collection_id
     and public.place_note_key(di.place_name) = v_key
     and (c.user_id = new.user_id or public.is_collection_member(c.id, new.user_id))
  on conflict (collection_id, public.place_note_key(place_name), url) do nothing;

  perform set_config('trasa.photo_sync', '', true);
  return new;
end; $function$;

create or replace function public.discovery_item_photo_unspread()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_key text := public.place_note_key(old.place_name);
begin
  if coalesce(current_setting('trasa.photo_sync', true), '') = '1' then return old; end if;
  if v_key = '' or old.user_id is null then return old; end if;
  perform set_config('trasa.photo_sync', '1', true);

  delete from public.discovery_item_photos d
   where d.user_id = old.user_id
     and d.url = old.url
     and public.place_note_key(d.place_name) = v_key;

  perform set_config('trasa.photo_sync', '', true);
  return old;
end; $function$;

-- Nowa pozycja w kolekcji dostaje moje istniejace zdjecia tego miejsca OD RAZU - bez tego
-- "przenoszenie" dzialaloby tylko do przodu (nowe zdjecia), a nie dla juz wrzuconych.
create or replace function public.discovery_item_photos_prefill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_key text := public.place_note_key(new.place_name);
begin
  if v_key = '' then return new; end if;
  perform set_config('trasa.photo_sync', '1', true);

  insert into public.discovery_item_photos (collection_id, place_name, user_id, url)
  select distinct new.collection_id, new.place_name, dip.user_id, dip.url
    from public.discovery_item_photos dip
   where public.place_note_key(dip.place_name) = v_key
     and dip.user_id is not null
     -- tylko ludzie, ktorzy maja co robic w TEJ kolekcji
     and (dip.user_id = (select c.user_id from public.discovery_collections c where c.id = new.collection_id)
          or public.is_collection_member(new.collection_id, dip.user_id))
  on conflict (collection_id, public.place_note_key(place_name), url) do nothing;

  perform set_config('trasa.photo_sync', '', true);
  return new;
end; $function$;

drop trigger if exists trg_dip_spread on public.discovery_item_photos;
create trigger trg_dip_spread after insert on public.discovery_item_photos
  for each row execute function public.discovery_item_photo_spread();

drop trigger if exists trg_dip_unspread on public.discovery_item_photos;
create trigger trg_dip_unspread after delete on public.discovery_item_photos
  for each row execute function public.discovery_item_photo_unspread();

drop trigger if exists trg_dip_prefill on public.discovery_items;
create trigger trg_dip_prefill after insert on public.discovery_items
  for each row execute function public.discovery_item_photos_prefill();
