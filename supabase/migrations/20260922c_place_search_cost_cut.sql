-- CIECIE KOSZTOW GOOGLE PLACES (2026-09-22). Trzy pomocniki, ktore pozwalaja apce pytac
-- NAJPIERW wlasna baze, a Google dopiero gdy u nas nic nie ma.
--
-- Kontekst rachunku za wrzesien (36,28 zl): to NIE byla wyszukiwarka. 2081 wywolan Text Search
-- zmiescilo sie w darmowej puli 5000/mies. Zaplacilismy za dwa SKU z pula raptem 1000 wywolan:
-- Place Details z atmosfera (25 $/1000) i Places Photo (7 $/1000), oba wolane przez pipeline
-- okladek przy zapisie planu i przy renderze miniaturek. Tamto jest wylaczone w kodzie apki.
-- Ta migracja zajmuje sie tym, co zaboli PRZY SKALI: wyszukiwaniem.

-- ── 1. Nasz katalog jako pierwsze zrodlo wynikow ──────────────────────────────
-- ⚠️ Miasto RANKUJE, a nie filtruje. Twardy filtr po miescie konczyl sie pusta lista
-- w kazdej kolekcji wielomiastowej (ta sama pulapka, co przy centroidzie w AddPlaceSheet).
create or replace function public.search_place_catalog(
  p_query text, p_city text default null, p_limit int default 8
)
returns table (
  id uuid, place_name text, address text, city text,
  latitude double precision, longitude double precision,
  category text, photo_url text, google_place_id text
)
language sql
stable
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as s)
  select p.id, p.place_name, p.address, p.city, p.latitude, p.longitude,
         coalesce(p.primary_category, p.category), p.photo_url, p.google_place_id
  from public.places p, q
  where p.is_active
    and length(q.s) >= 2
    and (lower(p.place_name) like '%' || q.s || '%'
      or lower(coalesce(p.address, '')) like '%' || q.s || '%')
  order by
    (case when lower(p.place_name) like q.s || '%' then 0 else 1 end),
    (case when p_city is not null and lower(coalesce(p.city, '')) = lower(p_city) then 0 else 1 end),
    length(p.place_name)
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

-- Indeks pod `like '%fraza%'` bez pg_trgm nie zadziala, ale przy 1000 wierszach skan i tak
-- trwa milisekundy. Przy dziesiatkach tysiecy: wlaczyc pg_trgm i dolozyc indeks GIN.
comment on function public.search_place_catalog(text, text, int) is
  'Wyszukiwarka po WLASNYM katalogu miejsc. Zero kosztu Google. Miasto rankuje, nie filtruje.';

-- ── 2. Srodek miasta z wlasnych danych ────────────────────────────────────────
-- ⛔ Do 22.09 arkusz dodawania miejsca geokodowal miasto PLATNYM Text Searchem ($32/1000)
-- tylko po to, zeby miec punkt do sortowania "najblizej najpierw". Mamy 1000 miejsc
-- z wspolrzednymi - srednia z nich jest darmowa i dokladniejsza (to srodek ciezkosci
-- naszych miejsc w tym miescie, a nie ratusz).
create or replace function public.city_center(p_city text)
returns table (latitude double precision, longitude double precision)
language sql
stable
as $$
  select avg(p.latitude)::double precision, avg(p.longitude)::double precision
  from public.places p
  where p.is_active
    and p.latitude is not null and p.longitude is not null
    and p_city is not null
    and lower(p.city) = lower(btrim(p_city))
  having count(*) > 0;
$$;

-- ── 3. Miesieczny limit platnych wywolan NA USERA ─────────────────────────────
-- Globalna kwota dzienna chroni rachunek, limit godzinowy na wolajacego chroni dostepnosc,
-- a tego brakowalo: sufitu na POJEDYNCZE KONTO w skali miesiaca. Jedno konto w petli nie moze
-- wygenerowac rachunku za wszystkich.
create table if not exists public.monthly_user_api_usage (
  month        date not null,
  user_id      uuid not null,
  google_calls int  not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (month, user_id)
);

alter table public.monthly_user_api_usage enable row level security;
-- Bez polityk: pisze i czyta WYLACZNIE funkcja ponizej (service_role z proxy).

create or replace function public.try_consume_user_google_quota(
  p_user uuid, p_n int, p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_month date := date_trunc('month', now() at time zone 'utc')::date; v_after int;
begin
  if p_user is null then return true; end if;  -- ruch bez konta lapie limit po IP w proxy
  insert into public.monthly_user_api_usage (month, user_id, google_calls, updated_at)
  values (v_month, p_user, greatest(p_n, 0), now())
  on conflict (month, user_id) do update
    set google_calls = public.monthly_user_api_usage.google_calls + greatest(p_n, 0),
        updated_at = now()
  returning google_calls into v_after;
  return v_after <= p_limit;
end;
$$;

revoke execute on function public.try_consume_user_google_quota(uuid, int, int) from public, anon, authenticated;
grant execute on function public.search_place_catalog(text, text, int) to anon, authenticated;
grant execute on function public.city_center(text) to anon, authenticated;
