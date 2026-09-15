-- Zaproszenie do wyjazdu wymaga ZGODY zaproszonego (2026-09-08)
--
-- Dotad host dodawal kogokolwiek jednym tapnieciem i ta osoba od razu miala wyjazd
-- u siebie w Wyjazdach - bez pytania. Obcy mogl wiec wrzucic Ci wyjazd do zakladki,
-- a pomylka hosta (klikniecie w zla osobe z listy) byla nieodwracalna.
--
-- Stan zamiast faktu: wiersz w group_session_members ma teraz 'pending' albo 'accepted'.
-- Istniejace wiersze dostaja 'accepted' - to ludzie, ktorzy juz wspoltworza swoje wyjazdy
-- i cofniecie im dostepu byloby regresja, a nie poprawka.

alter table public.group_session_members
  add column if not exists status text not null default 'accepted'
    check (status in ('pending', 'accepted'));

comment on column public.group_session_members.status is
  'pending = zaproszony, jeszcze nie potwierdzil; accepted = uczestnik. Zapytania listujace wyjazdy MUSZA filtrowac po accepted.';

create index if not exists group_session_members_pending_idx
  on public.group_session_members (user_id) where status = 'pending';

-- Host dodaje zaproszonego jako 'pending'. Sam siebie (zakladanie sesji) - jako 'accepted',
-- bo wlasnego wyjazdu nie trzeba akceptowac.
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
  if v_host <> auth.uid() then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  insert into public.group_session_members (session_id, user_id, status)
    values (p_session_id, p_user_id, case when p_user_id = v_host then 'accepted' else 'pending' end)
    on conflict (session_id, user_id) do nothing;
  return jsonb_build_object('ok', true);
end; $$;

/**
 * Zaproszony przyjmuje albo odrzuca. Odrzucenie KASUJE wiersz, nie zostawia 'declined':
 * inaczej host nie moglby zaprosic tej osoby ponownie (klucz glowny na parze sesja+user),
 * a lista uczestnikow zbieralaby slad po kazdej odmowie.
 */
create or replace function public.respond_to_route_invite(p_session_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_accept then
    update public.group_session_members
       set status = 'accepted'
     where session_id = p_session_id and user_id = auth.uid() and status = 'pending';
    if not found then return jsonb_build_object('ok', false, 'reason', 'no_invite'); end if;
  else
    delete from public.group_session_members
     where session_id = p_session_id and user_id = auth.uid();
  end if;
  return jsonb_build_object('ok', true);
end; $$;

revoke execute on function public.respond_to_route_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_route_invite(uuid, boolean) to authenticated;
