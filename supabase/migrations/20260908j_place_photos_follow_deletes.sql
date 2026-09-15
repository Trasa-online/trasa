-- Usuniete zdjecie znika TAKZE z wizytowki miejsca (2026-09-08, zgloszenie Nat)
--
-- sync_route_place_photos KOPIUJE zdjecia z wyjazdu do galerii miejsca (place_photos).
-- Kopia zyla wlasnym zyciem: user kasowal zdjecie u siebie, a ono nadal zaciagalo sie
-- na wizytowce. Z jego perspektywy usuniecie po prostu nie dzialalo.
--
-- Sprzatanie robimy w BAZIE, nie w kliencie: zrodel kopiowania sa dwa (pin_photos oraz
-- tablica pins.images), sciezek kasowania w aplikacji kilka, a kazda nowa powtorzylaby
-- ten sam blad po cichu. Wyzwalacz obejmuje wszystkie naraz, takze przyszle.

-- ── 1. Skasowany wiersz pin_photos ───────────────────────────────────────────
create or replace function public.place_photos_drop_for_pin_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(old.url, '') <> '' then
    delete from public.place_photos
     where photo_url = old.url
       and (old.user_id is null or user_id = old.user_id);
  end if;
  return old;
end; $$;

drop trigger if exists trg_pin_photos_drop_place_copy on public.pin_photos;
create trigger trg_pin_photos_drop_place_copy
  after delete on public.pin_photos
  for each row execute function public.place_photos_drop_for_pin_photo();

-- ── 2. Adres zniknal z tablicy pins.images ───────────────────────────────────
-- Tu nie ma wiersza do skasowania, tylko element tablicy - porownujemy stan przed i po.
create or replace function public.place_photos_drop_for_pin_images()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_gone text[];
begin
  select array(
    select u from unnest(coalesce(old.images, '{}')) u
     where coalesce(u, '') <> '' and not (u = any(coalesce(new.images, '{}')))
  ) into v_gone;
  if array_length(v_gone, 1) is null then return new; end if;

  -- Kopie w place_photos zaklada sync z user_id WLASCICIELA trasy - patrz drugi INSERT
  -- w sync_route_place_photos - wiec po nim kasujemy.
  select r.user_id into v_owner from public.routes r where r.id = new.route_id;
  delete from public.place_photos
   where photo_url = any(v_gone)
     and (v_owner is null or user_id = v_owner);
  return new;
end; $$;

drop trigger if exists trg_pins_images_drop_place_copy on public.pins;
create trigger trg_pins_images_drop_place_copy
  after update of images on public.pins
  for each row execute function public.place_photos_drop_for_pin_images();

-- ── 3. Sprzatanie tego, co juz osierociało ───────────────────────────────────
-- Kopie, ktorych zrodlo (pin_photos / pins.images) juz nie istnieje. Zdjecia wgrane
-- BEZPOSREDNIO do galerii miejsca (z wizytowki) nie maja zrodla w wyjezdzie i zostaja -
-- rozpoznajemy je po tym, ze nie leza w buckecie route-images.
delete from public.place_photos pp
 where pp.photo_url like '%/route-images/%'
   and not exists (select 1 from public.pin_photos x where x.url = pp.photo_url)
   and not exists (select 1 from public.pins p where pp.photo_url = any(coalesce(p.images, '{}')));
