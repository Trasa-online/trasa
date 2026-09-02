-- Zdjecia miejsca USUNIETEGO z wyjazdu nie moga wracac do galerii miejsca.
--
-- sync_route_place_photos zaciagalo pin_photos po samym route_id, bez sprawdzenia, czy miejsce
-- nadal jest w trasie. pin_photos sa kluczowane NAZWA miejsca, nie id pinu, wiec skasowanie pinu
-- ich nie ruszalo - przy najblizszej synchronizacji zdjecia usunietego miejsca ladowaly z powrotem
-- w place_photos (zgloszenie Nat 2026-09-01: "usuwam miejsce, a zdjecia i tak sie zapisuja",
-- plus duble po ponownym dodaniu miejsca).
--
-- Klient sprzata teraz pin_photos przy usuwaniu pinu, ale ta funkcja jest ostatnia linia obrony:
-- kanal 1 bierze wylacznie zdjecia miejsc, ktore FAKTYCZNIE sa jeszcze w trasie.
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

  -- 1) pin_photos - glowny kanal (zdjecia dodane przy miejscu w trakcie wyjazdu)
  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select s.place_key, s.place_name, s.city, s.user_id, s.photo_url
  from (
    select pp.user_id,
           pp.url as photo_url,
           pp.place_name,
           'nm:' || lower(trim(pp.place_name)) as place_key,
           r.city
    from public.pin_photos pp
    join public.routes r on r.id = pp.route_id
    where pp.route_id = p_route_id
      and pp.user_id is not null
      and coalesce(pp.url, '') <> ''
      -- miejsce musi nadal istniec w trasie
      and exists (
        select 1 from public.pins p
        where p.route_id = pp.route_id
          and lower(trim(p.place_name)) = lower(trim(pp.place_name))
      )
  ) s
  where not exists (
    select 1 from public.place_photos e
    where e.place_key = s.place_key and e.photo_url = s.photo_url
  );
  get diagnostics v_tmp = row_count;
  v_inserted := v_inserted + v_tmp;

  -- 2) pins.images - starszy kanal; autor = wlasciciel trasy (z natury tylko istniejace piny)
  insert into public.place_photos (place_key, place_name, city, user_id, photo_url)
  select s.place_key, s.place_name, s.city, s.user_id, s.photo_url
  from (
    select r.user_id,
           img as photo_url,
           p.place_name,
           'nm:' || lower(trim(p.place_name)) as place_key,
           r.city
    from public.pins p
    join public.routes r on r.id = p.route_id
    cross join lateral unnest(coalesce(p.images, '{}')) as img
    where p.route_id = p_route_id and coalesce(img, '') <> '' and r.user_id is not null
  ) s
  where not exists (
    select 1 from public.place_photos e
    where e.place_key = s.place_key and e.photo_url = s.photo_url
  );
  get diagnostics v_tmp = row_count;
  v_inserted := v_inserted + v_tmp;

  return v_inserted;
end;
$function$;
