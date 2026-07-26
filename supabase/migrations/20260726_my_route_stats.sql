-- Statystyki wykorzystania tras usera (do widoku "Statystyki" na profilu). saved_routes ma
-- RLS self-only (widzisz tylko wlasne zapisy), wiec autor trasy NIE moze z klienta policzyc
-- KTO zapisal jego trasy -> SECURITY DEFINER. Funkcja liczy TYLKO dla wolajacego (auth.uid()).
create or replace function public.my_route_stats()
returns table(uses bigint, people bigint, views bigint, completions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- ile razy zapisano moje trasy (kazde zapisanie)
    (select count(*) from public.saved_routes s join public.routes r on r.id = s.route_id where r.user_id = auth.uid()),
    -- ile ROZNYCH osob wykorzystalo moje trasy
    (select count(distinct s.user_id) from public.saved_routes s join public.routes r on r.id = s.route_id where r.user_id = auth.uid()),
    -- laczne wyswietlenia moich tras
    (select coalesce(sum(r.views), 0) from public.routes r where r.user_id = auth.uid()),
    -- ile razy ukonczono moje trasy
    (select count(*) from public.route_completions c join public.routes r on r.id = c.route_id where r.user_id = auth.uid());
$$;

grant execute on function public.my_route_stats() to authenticated;
