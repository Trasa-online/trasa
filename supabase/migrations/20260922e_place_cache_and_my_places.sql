-- DALSZE CIECIE KOSZTOW GOOGLE (2026-09-22, druga tura).
--
-- 1. CACHE ROZWIAZANYCH MIEJSC NA 30 DNI (bylo 7) - i OBOWIAZKOWE kasowanie po tym czasie.
--    Regulamin Google (Maps Platform Service Specific Terms) mowi wprost: "Customer may
--    temporarily cache latitude and longitude values from the Places API for up to 30
--    consecutive calendar days, AFTER WHICH Customer must delete the cached values".
--    Czyli 30 dni to nie jest szara strefa - to jest dozwolone maksimum. Mielismy 7 dni
--    (czyli placilismy 4x czesciej, niz trzeba) i ZERO kasowania (czyli wiersze starsze niz
--    30 dni lezaly w bazie wbrew tej samej regule - 15 takich bylo).
-- 2. WYSZUKIWARKA PYTA TEZ O MOJE WLASNE MIEJSCA - zero kosztu, a to najczestszy przypadek:
--    "dodaj kawiarnie, ktora mam juz w innej kolekcji".

create or replace function public.purge_stale_place_cache()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.place_details_cache where cached_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_stale_place_cache() from public, anon, authenticated;

select cron.schedule('purge-place-cache', '40 3 * * *', $$select public.purge_stale_place_cache();$$);

-- ── Moje wlasne miejsca (z planow i kolekcji) ────────────────────────────────
-- ⚠️ SECURITY DEFINER, bo laczy dwie tabele z roznymi politykami; filtr po `auth.uid()`
-- jest w srodku i nie da sie zapytac o cudze miejsca.
create or replace function public.search_my_places(p_query text, p_limit int default 6)
returns table (
  place_name text, address text, city text,
  latitude double precision, longitude double precision,
  category text, google_place_id text
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as s), me as (select auth.uid() as uid)
  select distinct on (lower(p.place_name))
         p.place_name, p.address, r.city, p.latitude, p.longitude, p.category, p.place_id
  from public.pins p
  join public.routes r on r.id = p.route_id
  cross join q cross join me
  where me.uid is not null
    and r.user_id = me.uid
    and r.deleted_at is null
    and length(q.s) >= 2
    and lower(p.place_name) like '%' || q.s || '%'
    and p.latitude is not null
  order by lower(p.place_name), p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

revoke execute on function public.search_my_places(text, int) from public, anon;
grant execute on function public.search_my_places(text, int) to authenticated;
