-- Zdjecie usera dodane do miejsca ZAKLADA to miejsce w eksploracji (prosba Nat 2026-09-06).
--
-- Skad luka: galeria miejsca (place_photos) i tabela miejsc (places) zyly osobno. User mogl
-- wgrac zdjecia do miejsca z trasy albo z listy, ktorego w `places` w ogole nie bylo - wiec
-- zakladka "Miejsca" go nie pokazywala, mimo ze mielismy juz jego zdjecie.
--
-- Model: tworzymy WYLACZNIE wiersz w `places` (wizytowka "zero" - miejsce bez konta
-- biznesowego). ZADNEGO business_profiles: konto zaklada dopiero firma, przejmujac wizytowke.
--
-- Wpiete triggerem na place_photos, wiec obejmuje WSZYSTKIE kanaly naraz: wgranie z wizytowki,
-- podpiecie zdjecia z pozycji listy oraz zbiorczy przerzut z opublikowanego wyjazdu
-- (sync_route_place_photos). Nowy kanal zdjec dostanie to samo za darmo.

-- Wspolrzedne/kategoria/adres: place_photos ich nie ma, wiec dociagamy je z tego, co user
-- juz o miejscu zapisal - pin w trasie albo pozycja listy. Bez tego miejsce wpadaloby do
-- eksploracji bez pozycji na mapie i bez kategorii (czyli i bez filtra).
create or replace function public.ensure_place_from_photo(
  p_place_name text,
  p_city       text,
  p_category   text default null,
  p_latitude   double precision default null,
  p_longitude  double precision default null,
  p_address    text default null,
  p_google_place_id text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := nullif(btrim(p_place_name), '');
  v_city text := nullif(btrim(p_city), '');
  v_gpid text := nullif(btrim(p_google_place_id), '');
  v_cat  text := nullif(btrim(p_category), '');
  v_lat  double precision := p_latitude;
  v_lng  double precision := p_longitude;
  v_addr text := nullif(btrim(p_address), '');
begin
  -- Bez nazwy albo miasta nie ma czego pokazac w eksploracji (places.city jest NOT NULL).
  -- Zdjecie zostaje w galerii miejsca - po prostu nie zakladamy wpisu.
  if v_name is null or v_city is null then return null; end if;
  if length(v_name) > 200 or length(v_city) > 120 then return null; end if;

  -- Kanoniczna tozsamosc: google_place_id (partial unique index), potem nazwa + miasto.
  if v_gpid is not null then
    select id into v_id from public.places where google_place_id = v_gpid limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.places
     where lower(place_name) = lower(v_name) and lower(city) = lower(v_city)
     order by created_at nulls last limit 1;
  end if;

  -- Uzupelnienie brakow z pinu trasy / pozycji listy o tej samej nazwie.
  if v_lat is null or v_lng is null or v_cat is null then
    select coalesce(v_cat, s.category), coalesce(v_lat, s.latitude), coalesce(v_lng, s.longitude), coalesce(v_addr, s.address)
      into v_cat, v_lat, v_lng, v_addr
    from (
      (select p.category, p.latitude, p.longitude, p.address
         from public.pins p
        where lower(btrim(p.place_name)) = lower(v_name) and p.latitude is not null
        limit 1)
      union all
      (select di.category, di.latitude, di.longitude, di.address
         from public.discovery_items di
        where lower(btrim(di.place_name)) = lower(v_name) and di.latitude is not null
        limit 1)
    ) s limit 1;
  end if;

  if v_id is not null then
    -- Miejsce juz jest: dokladamy tylko to, czego brakowalo. is_active CELOWO zostaje jakie
    -- bylo - miejsce wylaczone przez admina (moderacja) nie moze wrocic przez zdjecie usera.
    update public.places set
      google_place_id = coalesce(google_place_id, v_gpid),
      latitude        = coalesce(latitude, v_lat),
      longitude       = coalesce(longitude, v_lng),
      address         = coalesce(nullif(btrim(address), ''), v_addr),
      category        = case when coalesce(nullif(btrim(category), ''), 'other') = 'other'
                             then coalesce(v_cat, category) else category end
    where id = v_id;
    return v_id;
  end if;

  insert into public.places (place_name, city, category, address, latitude, longitude, google_place_id, is_active)
  values (v_name, v_city, coalesce(v_cat, 'other'), v_addr, v_lat, v_lng, v_gpid, true)
  returning id into v_id;
  return v_id;
exception
  -- Wyscig na unikalnym google_place_id: ktos zdazyl wstawic to samo miejsce. Oddaj jego id.
  when unique_violation then
    select id into v_id from public.places where google_place_id = v_gpid limit 1;
    return v_id;
end $$;

-- Trigger: kazde zdjecie dopisane do galerii miejsca zaklada/uzupelnia jego wpis w eksploracji.
-- Best-effort - blad nie moze wywrocic dodania zdjecia (to glowna akcja usera).
create or replace function public.place_photos_ensure_place()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.ensure_place_from_photo(new.place_name, new.city);
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists trg_place_photos_ensure_place on public.place_photos;
create trigger trg_place_photos_ensure_place
  after insert on public.place_photos
  for each row execute function public.place_photos_ensure_place();

-- Funkcja jest WEWNETRZNA: wola ja wylacznie trigger (jako wlasciciel). Klient nie dostaje
-- do niej dostepu, zeby nie dalo sie zasypac eksploracji wymyslonymi nazwami z pominieciem
-- realnego wgrania zdjecia (upload + moderacja SafeSearch to naturalny hamulec).
revoke all on function public.ensure_place_from_photo(text, text, text, double precision, double precision, text, text) from public, anon, authenticated;

-- Backfill: miejsca, ktore JUZ maja zdjecia userow, a nie ma ich w eksploracji.
insert into public.places (place_name, city, category, address, latitude, longitude, is_active)
select distinct on (lower(btrim(pp.place_name)), lower(btrim(pp.city)))
       btrim(pp.place_name), btrim(pp.city),
       coalesce(src.category, 'other'), src.address, src.latitude, src.longitude, true
from public.place_photos pp
left join lateral (
  select s.category, s.latitude, s.longitude, s.address from (
    (select p.category, p.latitude, p.longitude, p.address
       from public.pins p
      where lower(btrim(p.place_name)) = lower(btrim(pp.place_name)) and p.latitude is not null
      limit 1)
    union all
    (select di.category, di.latitude, di.longitude, di.address
       from public.discovery_items di
      where lower(btrim(di.place_name)) = lower(btrim(pp.place_name)) and di.latitude is not null
      limit 1)
  ) s limit 1
) src on true
where coalesce(btrim(pp.place_name), '') <> ''
  and coalesce(btrim(pp.city), '') <> ''
  and not exists (
    select 1 from public.places e
     where lower(e.place_name) = lower(btrim(pp.place_name))
       and lower(e.city) = lower(btrim(pp.city))
  )
order by lower(btrim(pp.place_name)), lower(btrim(pp.city)), pp.created_at;
