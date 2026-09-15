-- Zdjecia dodane do MIEJSCA NA LISCIE trafiaja do galerii miejsca (place_photos).
--
-- Zgloszenie Nat 2026-09-09: "zdjecia widac w listach i na wyjazdach, ale po kliknieciu
-- w miejsce wizytowka jest pusta". Trasy mialy juz swoj most (sync_route_place_photos +
-- triggery kasujace), listy nie mialy zadnego - zdjecie zylo wylacznie w
-- discovery_items.images. Wizytowka czyta place_photos, wiec o tych zdjeciach nie wiedziala.
-- W bazie: 33 zdjecia z 13 miejsc na listach PUBLICZNYCH, ktorych wizytowki nie widzialy.
--
-- Symetria z trasami jest celowa - ta sama tabela, ten sam klucz 'nm:<nazwa>', te same
-- reguly kasowania. Roznica jest jedna i wynika z prywatnosci: trasa dzieli sie zdjeciami
-- dopiero po publikacji, lista - dopiero gdy jest PUBLICZNA i zatwierdzona. Lista "Ogolne"
-- (prywatna wishlista) nie zasila niczyjej wizytowki.

-- ── Wstawianie ────────────────────────────────────────────────────────────────
create or replace function public.sync_list_place_photos(p_collection_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_inserted integer := 0;
begin
  if not exists (
    select 1 from public.discovery_collections c
    where c.id = p_collection_id
      and c.is_public = true
      and coalesce(c.moderation_status, 'approved') = 'approved'
  ) then
    return 0;
  end if;

  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select s.place_key, s.place_name, s.city, s.user_id, s.photo_url
  from (
    select c.user_id,
           img as photo_url,
           di.place_name,
           'nm:' || lower(trim(di.place_name)) as place_key,
           coalesce(di.city, c.city) as city
    from public.discovery_items di
    join public.discovery_collections c on c.id = di.collection_id
    cross join lateral unnest(coalesce(di.images, '{}')) as img
    where di.collection_id = p_collection_id
      and coalesce(img, '') <> ''
      and coalesce(trim(di.place_name), '') <> ''
      and c.user_id is not null
  ) s
  on conflict (place_key, photo_url) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end; $$;

-- ── Trigger: zdjecie dopisane do pozycji listy ────────────────────────────────
create or replace function public.place_photos_add_for_list_item()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_city text; v_new text[]; v_before text[];
begin
  -- OLD nie istnieje przy INSERT, wiec czytamy je tylko w galezi UPDATE (galezie IF w plpgsql
  -- sa wykonywane leniwie - odwolanie do OLD w niewybranej galezi CASE bywa bledem).
  if tg_op = 'UPDATE' then v_before := coalesce(old.images, '{}'); else v_before := '{}'; end if;
  select array(
    select u from unnest(coalesce(new.images, '{}')) u
     where coalesce(u, '') <> '' and not (u = any(v_before))
  ) into v_new;
  if array_length(v_new, 1) is null then return new; end if;
  if coalesce(trim(new.place_name), '') = '' then return new; end if;

  select c.user_id, coalesce(new.city, c.city) into v_owner, v_city
    from public.discovery_collections c
   where c.id = new.collection_id
     and c.is_public = true
     and coalesce(c.moderation_status, 'approved') = 'approved';
  if v_owner is null then return new; end if;

  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select 'nm:' || lower(trim(new.place_name)), new.place_name, v_city, v_owner, u
    from unnest(v_new) u
  on conflict (place_key, photo_url) do nothing;
  return new;
end; $$;

-- ── Trigger: zdjecie usuniete z pozycji listy ─────────────────────────────────
-- Lustro place_photos_drop_for_pin_images: kasujemy WYLACZNIE kopie zalozona przez
-- wlasciciela listy, zeby cudze zdjecia tego samego miejsca zostaly nietkniete.
create or replace function public.place_photos_drop_for_list_item()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_gone text[]; v_after text[];
begin
  -- NEW nie istnieje przy DELETE - patrz komentarz przy triggerze dopisujacym.
  if tg_op = 'DELETE' then v_after := '{}'; else v_after := coalesce(new.images, '{}'); end if;
  select array(
    select u from unnest(coalesce(old.images, '{}')) u
     where coalesce(u, '') <> '' and not (u = any(v_after))
  ) into v_gone;
  if array_length(v_gone, 1) is null then return coalesce(new, old); end if;

  select c.user_id into v_owner
    from public.discovery_collections c where c.id = old.collection_id;
  delete from public.place_photos
   where photo_url = any(v_gone)
     and (v_owner is null or user_id = v_owner);
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_place_photos_add_for_list_item on public.discovery_items;
create trigger trg_place_photos_add_for_list_item
  after insert or update of images on public.discovery_items
  for each row execute function public.place_photos_add_for_list_item();

drop trigger if exists trg_place_photos_drop_for_list_item on public.discovery_items;
create trigger trg_place_photos_drop_for_list_item
  after update of images or delete on public.discovery_items
  for each row execute function public.place_photos_drop_for_list_item();

-- ── Trigger: lista staje sie publiczna / zostaje zatwierdzona ─────────────────
-- Zdjecia dodane, gdy lista byla jeszcze prywatna albo czekala na moderacje, wchodza
-- do galerii miejsc dopiero w tym momencie - nie wczesniej.
create or replace function public.place_photos_sync_on_list_visible()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.is_public = true and coalesce(new.moderation_status, 'approved') = 'approved'
     and (old.is_public is distinct from new.is_public
          or old.moderation_status is distinct from new.moderation_status) then
    perform public.sync_list_place_photos(new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_place_photos_sync_on_list_visible on public.discovery_collections;
create trigger trg_place_photos_sync_on_list_visible
  after update on public.discovery_collections
  for each row execute function public.place_photos_sync_on_list_visible();

-- ── Backfill istniejacej tresci ───────────────────────────────────────────────
do $$
declare r record; n integer := 0;
begin
  for r in select id from public.discovery_collections
            where is_public = true and coalesce(moderation_status, 'approved') = 'approved'
  loop
    n := n + public.sync_list_place_photos(r.id);
  end loop;
  raise notice 'sync_list_place_photos: dodano % zdjec', n;
end $$;
