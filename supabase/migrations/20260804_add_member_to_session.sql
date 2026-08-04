-- ============================================================================
-- Faza 2 tras grupowych (2026-08-04): host dodaje uczestnika do sesji.
-- group_session_members INSERT = tylko self-insert (WITH CHECK auth.uid()=user_id),
-- wiec host NIE moze wstawic cudzego user_id. Ta RPC (SECURITY DEFINER, host-only guard)
-- pozwala hostowi sesji dodac zaproszonego. Wzorzec 1:1 z copy_group_session_routes.
-- ============================================================================

create or replace function public.add_member_to_session(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_host uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select created_by into v_host from public.group_sessions where id = p_session_id;
  if v_host is null then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;
  -- Tylko host sesji moze dodawac uczestnikow.
  if v_host <> auth.uid() then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  insert into public.group_session_members (session_id, user_id)
    values (p_session_id, p_user_id)
    on conflict (session_id, user_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.add_member_to_session(uuid, uuid) to authenticated;
