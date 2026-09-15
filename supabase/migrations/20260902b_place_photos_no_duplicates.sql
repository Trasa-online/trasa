-- ZDJECIA 1:1 NIGDY WIECEJ NIE DUBLUJA SIE W GALERII MIEJSCA (prosba Nat 2026-09-01).
--
-- Dotad jedyna ochrona byl warunek `where not exists` w sync_route_place_photos - czyli w JEDNEJ
-- sciezce, sprawdzany tuz przed insertem (wyscig przy dwoch rownoleglych synchronizacjach) i
-- omijany przez kazda inna sciezke zapisu. Teraz pilnuje tego baza, dla wszystkich sciezek naraz.
--
-- Dwa poziomy, bo "to samo zdjecie" ma dwa znaczenia:
--   1. ten sam ADRES pod tym samym miejscem - klasyczny dubel po ponownym dodaniu miejsca;
--   2. ta sama TRESC pod roznymi adresami - np. dwie osoby wgrywaja identyczny plik. Klient liczy
--      SHA-256 z przetworzonego pliku i zapisuje w photo_hash; indeks czesciowy (bo stare wiersze
--      hasha nie maja) nie pusci drugiego takiego samego zdjecia do tego samego miejsca.

-- 0) sprzatanie: zdjecia miejsc, ktorych juz nie ma w swoich trasach (osierocone pin_photos)
delete from public.place_photos e
where exists (
  select 1 from public.pin_photos pp
  where e.photo_url = pp.url
    and e.place_key = 'nm:' || lower(trim(pp.place_name))
    and not exists (
      select 1 from public.pins p
      where p.route_id = pp.route_id
        and lower(trim(p.place_name)) = lower(trim(pp.place_name))
    )
);

delete from public.pin_photos pp
where not exists (
  select 1 from public.pins p
  where p.route_id = pp.route_id
    and lower(trim(p.place_name)) = lower(trim(pp.place_name))
);

-- 1) odsiew ewentualnych istniejacych dubli (zostaje najstarszy wiersz)
delete from public.place_photos a
using public.place_photos b
where a.place_key = b.place_key
  and a.photo_url = b.photo_url
  and a.created_at > b.created_at;

-- 2) ten sam adres pod tym samym miejscem - niemozliwy
create unique index if not exists place_photos_key_url_uniq
  on public.place_photos (place_key, photo_url);

-- 3) ta sama tresc pod tym samym miejscem - niemozliwa (gdy klient poda hash)
alter table public.place_photos add column if not exists photo_hash text;
create unique index if not exists place_photos_key_hash_uniq
  on public.place_photos (place_key, photo_hash)
  where photo_hash is not null;

-- 4) synchronizacja nie moze sie juz wywalic na kolizji (rownolegle wywolania)
create or replace function public.sync_route_place_photos(p_route_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_inserted integer := 0; v_tmp integer;
begin
  if not exists (
    select 1 from public.routes r
    where r.id = p_route_id and coalesce(r.status, 'draft') = 'published'
  ) then
    return 0;
  end if;

  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select s.place_key, s.place_name, s.city, s.user_id, s.photo_url
  from (
    select pp.user_id, pp.url as photo_url, pp.place_name,
           'nm:' || lower(trim(pp.place_name)) as place_key, r.city
    from public.pin_photos pp
    join public.routes r on r.id = pp.route_id
    where pp.route_id = p_route_id
      and pp.user_id is not null
      and coalesce(pp.url, '') <> ''
      and exists (
        select 1 from public.pins p
        where p.route_id = pp.route_id
          and lower(trim(p.place_name)) = lower(trim(pp.place_name))
      )
  ) s
  on conflict (place_key, photo_url) do nothing;
  get diagnostics v_tmp = row_count;
  v_inserted := v_inserted + v_tmp;

  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select s.place_key, s.place_name, s.city, s.user_id, s.photo_url
  from (
    select r.user_id, img as photo_url, p.place_name,
           'nm:' || lower(trim(p.place_name)) as place_key, r.city
    from public.pins p
    join public.routes r on r.id = p.route_id
    cross join lateral unnest(coalesce(p.images, '{}')) as img
    where p.route_id = p_route_id and coalesce(img, '') <> '' and r.user_id is not null
  ) s
  on conflict (place_key, photo_url) do nothing;
  get diagnostics v_tmp = row_count;
  v_inserted := v_inserted + v_tmp;

  return v_inserted;
end;
$function$;
