-- =====================================================================
-- Miesieczny limit BUDZETOWY dla Text Search (wyszukiwarka tworzenia trasy).
-- Bezpiecznik kosztowy: gdy w danym miesiacu liczba wywolan Text Search przekroczy
-- prog, google-places-proxy PRZESTAJE wolac Google dla akcji "textsearch" i zwraca
-- pusty wynik (quota_exceeded). Chroni przed niespodziewanym rachunkiem po launchu.
--
-- Prog domyslny 8000/mies ~= $256 przy $32/1000 (cel: max ~$260/mies na wyszukiwarce).
-- Konfigurowalny env GOOGLE_TEXTSEARCH_MONTHLY_LIMIT w edge function.
--
-- Licznik miesieczny w UTC (pierwszy dzien miesiaca jako klucz). Funkcje SECURITY
-- DEFINER - wola je tylko service role z edge functions. Brak RLS dla anon/auth.
-- =====================================================================

create table if not exists public.monthly_api_usage (
  month date primary key,               -- pierwszy dzien miesiaca (UTC)
  textsearch_calls integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.monthly_api_usage enable row level security;
-- celowo brak polityk: dostep tylko przez SECURITY DEFINER RPC (service role)

-- Atomowo: jesli (biezace + p_n) <= p_limit -> zwieksz licznik i zwroc true (mozna wolac Google).
-- Inaczej zwroc false (budzet miesieczny wyczerpany, NIE wolaj Google). Liczy miesiac w UTC.
create or replace function public.try_consume_textsearch_month(p_n integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_calls integer;
begin
  insert into public.monthly_api_usage (month, textsearch_calls)
  values (v_month, 0)
  on conflict (month) do nothing;

  select textsearch_calls into v_calls
  from public.monthly_api_usage
  where month = v_month
  for update;

  if v_calls + p_n > p_limit then
    return false;
  end if;

  update public.monthly_api_usage
    set textsearch_calls = textsearch_calls + p_n, updated_at = now()
    where month = v_month;

  return true;
end;
$$;

-- Podglad zuzycia miesiecznego (admin/debug) - ostatnie 12 miesiecy.
create or replace function public.textsearch_month_usage()
returns table (month date, textsearch_calls integer)
language sql
security definer
set search_path = public
as $$
  select month, textsearch_calls
  from public.monthly_api_usage
  order by month desc
  limit 12;
$$;
