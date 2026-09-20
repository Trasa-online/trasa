-- Uczestnik wspolnego wyjazdu (planu) edytuje OPIS i NAZWE (prosba Nat 2026-09-20, pkt 3:
-- "Add note usunac i dodac opcje dodaj opis"). `routes` ma UPDATE tylko dla wlasciciela, a
-- pelna polityka UPDATE dla czlonkow dalaby im tez status, daty, okladke i usuwanie z kosza -
-- dlatego DWA waskie SECDEF RPC na dokladnie te dwa pola. Wyzwalacze cenzury tytulu
-- (reject_banned_*) dzialaja niezaleznie od tego, kto wola.

create or replace function public.set_trip_description(p_route uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select user_id, group_session_id into v_owner, v_session from routes where id = p_route and deleted_at is null;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> v_uid and not (v_session is not null and exists (
      select 1 from group_session_members m where m.session_id = v_session and m.user_id = v_uid)) then
    raise exception 'not_allowed';
  end if;
  update routes set review_narrative = nullif(btrim(coalesce(p_description, '')), '') where id = p_route;
end;
$$;

create or replace function public.set_trip_title(p_route uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid;
  v_owner uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_title = '' then raise exception 'empty_title'; end if;
  select user_id, group_session_id into v_owner, v_session from routes where id = p_route and deleted_at is null;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> v_uid and not (v_session is not null and exists (
      select 1 from group_session_members m where m.session_id = v_session and m.user_id = v_uid)) then
    raise exception 'not_allowed';
  end if;
  update routes set title = v_title where id = p_route;
end;
$$;

revoke execute on function public.set_trip_description(uuid, text) from public, anon;
revoke execute on function public.set_trip_title(uuid, text) from public, anon;
grant execute on function public.set_trip_description(uuid, text) to authenticated;
grant execute on function public.set_trip_title(uuid, text) to authenticated;
