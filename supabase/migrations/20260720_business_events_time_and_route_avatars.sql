-- 1) Godziny wydarzenia (opcjonalne). Data (starts_at/ends_at) zostaje wymagana; godzina
--    to dodatkowy szczegol wyswietlany na wizytowce ("18:00 - 22:00"). Lokal uzupelnia je
--    w dashboardzie biznesowym (formularz dodawania/edycji wydarzenia).
alter table public.business_events
  add column if not exists start_time time,
  add column if not exists end_time time;

-- 2) Awatary uzytkownikow, ktorzy dodali dany lokal do swojej trasy (social proof / FOMO na
--    wizytowce). Zwraca liczbe unikalnych osob + probke awatarow (max 8, UI pokazuje 4 + "+N").
--    SECURITY DEFINER: pomija RLS pins/routes/profiles, ale eksponuje TYLKO awatar + nazwe
--    uzytkownika, ktory publicznie zaplanowal to miejsce - swiadome ujawnienie dla efektu FOMO.
create or replace function public.get_place_route_avatars(p_place_id text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with users_with_place as (
    select distinct r.user_id
    from public.pins p
    join public.routes r on r.id = p.route_id
    where p.place_id = p_place_id
      and r.user_id is not null
  )
  select json_build_object(
    'total', (select count(*) from users_with_place),
    'avatars', coalesce((
      select json_agg(a) from (
        select pr.avatar_url, pr.username, pr.first_name
        from users_with_place u
        join public.profiles pr on pr.id = u.user_id
        where pr.avatar_url is not null
        order by pr.created_at desc nulls last
        limit 8
      ) a
    ), '[]'::json)
  );
$$;

grant execute on function public.get_place_route_avatars(text) to anon, authenticated;
