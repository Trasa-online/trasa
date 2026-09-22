-- BEZPIECZNIKI KOSZTOWE PO ZMIANIE ARCHITEKTURY (2026-09-22).
--
-- Po przejsciu na Autocomplete w sesji zdecydowana wiekszosc zapytan do Google jest DARMOWA,
-- a placimy wylacznie za "resolve", czyli jedno Place Details w chwili, gdy user WYBIERZE
-- miejsce. Stare bezpieczniki liczyly wszystkie zapytania razem, wiec przy 10 tys. userow
-- odcielyby wyszukiwarke WSZYSTKIM, mimo ze rachunek bylby maly.
--
-- Teraz sa trzy, kazdy o czym innym:
--   1. `try_consume_google_quota`    - DZIENNY limit zapytan (dostepnosc: petla w kodzie,
--                                      bot, zle napisany skrypt). Env GOOGLE_DAILY_CALL_LIMIT.
--   2. `try_consume_resolve_month`   - MIESIECZNY budzet PLATNYCH resolve (pieniadze). To jest
--                                      twardy sufit rachunku. Env GOOGLE_RESOLVE_MONTHLY_LIMIT.
--   3. `try_consume_user_google_quota` - miesieczny limit NA KONTO (jeden user nie generuje
--                                      rachunku za wszystkich). Env GOOGLE_MONTHLY_PER_USER.
alter table public.monthly_api_usage add column if not exists resolve_calls int not null default 0;

create or replace function public.try_consume_resolve_month(p_n int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_month date := date_trunc('month', now() at time zone 'utc')::date; v_after int;
begin
  insert into public.monthly_api_usage (month, resolve_calls, updated_at)
  values (v_month, greatest(p_n, 0), now())
  on conflict (month) do update
    set resolve_calls = public.monthly_api_usage.resolve_calls + greatest(p_n, 0),
        updated_at = now()
  returning resolve_calls into v_after;
  return v_after <= p_limit;
end;
$$;

revoke execute on function public.try_consume_resolve_month(int, int) from public, anon, authenticated;
