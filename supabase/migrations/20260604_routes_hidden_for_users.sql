-- routes.hidden_for_users: lista user_id ktorzy ukryli ta trase z dziennika
-- (analogicznie do new_for_users, ale odwrotny semantyka: 'ukryj z mojego widoku').
-- Pozwala userowi schowac trase bez usuwania (np. trasa grupowa member chce sie
-- pozbyc z listy ale nie wyjsc z sesji).
--
-- Kategorie w dzienniku:
--   AKTYWNE  - start_date >= today (lub null), NOT IN hidden_for_users
--   POCZTOWKI - start_date < today, NOT IN hidden_for_users
--   UKRYTE   - IN hidden_for_users (osobna zakladka)

alter table public.routes
  add column if not exists hidden_for_users uuid[] not null default '{}';

comment on column public.routes.hidden_for_users is
  'Lista user_id ktorzy ukryli ta trase z dziennika. Trasa pozostaje w bazie i u tworcy, ale ci uzytkownicy nie widza jej w glownej liscie - tylko w zakladce Ukryte.';

-- RPC: hide route dla aktualnego usera (array_append + dedup)
create or replace function public.hide_route_for_user(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  update public.routes
  set hidden_for_users = (
    select array(
      select distinct unnest(coalesce(hidden_for_users, '{}'::uuid[]) || v_user_id)
    )
  )
  where id = p_route_id;
end;
$$;

-- RPC: unhide route dla aktualnego usera (array_remove)
create or replace function public.unhide_route_for_user(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  update public.routes
  set hidden_for_users = array_remove(coalesce(hidden_for_users, '{}'::uuid[]), v_user_id)
  where id = p_route_id;
end;
$$;

grant execute on function public.hide_route_for_user(uuid) to authenticated;
grant execute on function public.unhide_route_for_user(uuid) to authenticated;

-- Index dla efektywnych queries (filtrowanie wg user.id IN/NOT IN hidden_for_users)
create index if not exists routes_hidden_for_users_gin_idx
  on public.routes using gin (hidden_for_users);
