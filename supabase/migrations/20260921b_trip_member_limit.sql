-- Limit WSPOLTWORCOW planu: najwyzej 10 osob poza wlascicielem (decyzja Nat 2026-09-21).
-- Egzekwowany W BAZIE (regula z audytow: filtr w obu miejscach). Klient sprawdza przed
-- wysylka, zeby pokazac czytelny toast zamiast „Nie udalo sie zaprosic".
-- Zmieniasz liczbe - zmien tez `MAX_TRIP_MEMBERS` w src/lib/placeLimits.ts.

create or replace function public.guard_group_session_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit constant int := 10;
  v_host uuid;
  v_count int;
begin
  select created_by into v_host from public.group_sessions where id = new.session_id;
  -- Host nie liczy sie do limitu (to jego plan).
  if v_host is not null and new.user_id = v_host then return new; end if;
  select count(*) into v_count
    from public.group_session_members m
   where m.session_id = new.session_id
     and (v_host is null or m.user_id <> v_host);
  if v_count >= v_limit then
    raise exception 'member_limit' using
      detail = format('session %s already has %s members', new.session_id, v_limit),
      hint = 'trip_members';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_session_member_limit on public.group_session_members;
create trigger trg_group_session_member_limit
  before insert on public.group_session_members
  for each row execute function public.guard_group_session_member_limit();

-- RPC hosta oddaje czytelny powod zamiast wyjatku - klient mapuje go na toast.
create or replace function public.add_member_to_session(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_host uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select created_by into v_host from public.group_sessions where id = p_session_id;
  if v_host is null then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;
  if v_host <> auth.uid() then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  begin
    insert into public.group_session_members (session_id, user_id, status)
      values (p_session_id, p_user_id, case when p_user_id = v_host then 'accepted' else 'pending' end)
      on conflict (session_id, user_id) do nothing;
  exception when others then
    if sqlerrm = 'member_limit' then
      return jsonb_build_object('ok', false, 'reason', 'member_limit');
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true);
end; $function$;
