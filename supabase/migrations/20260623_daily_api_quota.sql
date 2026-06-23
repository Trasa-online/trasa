-- =====================================================================
-- Dzienny limit (quota cap) wywolan platnego Google Places API.
-- Bezpiecznik: gdy w danym dniu liczba wywolan przekroczy prog, edge functions
-- (google-places-proxy, cache-place-photo) PRZESTAJA wolac Google i zwracaja
-- cache/null. Chroni przed naglym skokiem kosztu (np. 200 zl/dzien).
--
-- Licznik dzienny w UTC. Funkcje sa SECURITY DEFINER - wola je tylko service role
-- z edge functions. Brak polityk RLS dla anon/auth (tabela niewidoczna z klienta).
-- =====================================================================

create table if not exists public.daily_api_usage (
  day date primary key,
  google_calls integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.daily_api_usage enable row level security;
-- celowo brak polityk: dostep tylko przez SECURITY DEFINER RPC (service role)

-- Atomowo: jesli (biezace + p_n) <= p_limit -> zwieksz licznik i zwroc true (mozna wolac Google).
-- Inaczej zwroc false (limit przekroczony, NIE wolaj Google). Liczy dzien w UTC.
create or replace function public.try_consume_google_quota(p_n integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_calls integer;
begin
  insert into public.daily_api_usage (day, google_calls)
  values (v_today, 0)
  on conflict (day) do nothing;

  select google_calls into v_calls
  from public.daily_api_usage
  where day = v_today
  for update;

  if v_calls + p_n > p_limit then
    return false;
  end if;

  update public.daily_api_usage
    set google_calls = google_calls + p_n, updated_at = now()
    where day = v_today;

  return true;
end;
$$;

-- Podglad zuzycia (dla admina/debug) - ostatnie 14 dni.
create or replace function public.google_quota_usage()
returns table (day date, google_calls integer)
language sql
security definer
set search_path = public
as $$
  select day, google_calls
  from public.daily_api_usage
  where day >= (now() at time zone 'utc')::date - 14
  order by day desc;
$$;
