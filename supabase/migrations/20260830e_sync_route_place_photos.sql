-- Zdjecia z wyjazdu -> galeria MIEJSCA (2026-08-30, zgloszenie Nat: "Talerzyki" mial 4 zdjecia
-- w pin_photos, a place_photos 0 - wiec miniaturka miejsca byla pusta, a wizytowka nic nie miala).
--
-- Kanaly zdjec przy miejscu: pin_photos (dodane w widoku wyjazdu, z autorem) oraz pins.images
-- (starszy kanal). Galeria miejsca i okladki miejsc czytaja WYLACZNIE place_photos - stad luka.
--
-- Kopiujemy TYLKO z wyjazdow OPUBLIKOWANYCH: zdjecia z roboczego/trwajacego nie moga wyciekac do
-- publicznej galerii miejsca (place_photos ma public read). Autorstwo zachowane (user_id), wiec
-- RLS "usun swoje" dziala jak dla zdjec dodanych z wizytowki. SECURITY DEFINER, bo klient moze
-- wstawiac do place_photos tylko WLASNE wiersze, a host publikujacy wyjazd grupowy przenosi tez
-- zdjecia innych uczestnikow. Idempotentne (dedup po place_key + photo_url).
create or replace function public.sync_route_place_photos(p_route_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
           -- pins NIE ma google_place_id (to kolumna places), a klient dla pinow i tak liczy
           -- klucz z samej nazwy (pinCoverKeys -> "nm:"). Trzymamy sie tego samego klucza.
           'nm:' || lower(trim(pp.place_name)) as place_key,
           r.city
    from public.pin_photos pp
    join public.routes r on r.id = pp.route_id
    where pp.route_id = p_route_id
      and pp.user_id is not null
      and coalesce(pp.url, '') <> ''
  ) s
  where not exists (
    select 1 from public.place_photos e
    where e.place_key = s.place_key and e.photo_url = s.photo_url
  );
  get diagnostics v_tmp = row_count;
  v_inserted := v_inserted + v_tmp;

  -- 2) pins.images - starszy kanal; autor = wlasciciel trasy
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
$$;

grant execute on function public.sync_route_place_photos(uuid) to authenticated;
