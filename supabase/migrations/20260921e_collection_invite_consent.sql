-- ZAPROSZENIE DO KOLEKCJI WYMAGA ZGODY (prosba Nat 2026-09-21: „dopiero po wyrazeniu zgody
-- user powinien sie pojawic w kolekcji"). Do tej pory `add_member_to_collection` dopisywalo
-- osobe OD RAZU - stad guziki „Otworz / Nie teraz" w powiadomieniu, ktore nie mogly obiecac
-- decyzji (komentarz w NotificationsDrawer). Wyjazdy mialy zgode od 2026-09-08
-- (`group_session_members.status` + `respond_to_route_invite`) - tu lustro tego modelu.
--
-- `status`: 'pending' (zaproszony, jeszcze nie odpowiedzial) | 'accepted'.
--  - `is_collection_member`   = WSPOLTWORCA (accepted) - bramkuje ZAPIS (miejsca, notki, zdjecia, gwiazdki);
--  - `is_collection_invitee`  = accepted LUB pending - bramkuje ODCZYT (zaproszony ma zobaczyc,
--    na co sie zgadza, takze w kolekcji prywatnej);
--  - do „Zapisane" zaproszonego kolekcja trafia dopiero po AKCEPTACJI.

alter table public.discovery_collection_members
  add column if not exists status text not null default 'accepted';
alter table public.discovery_collection_members
  drop constraint if exists dcm_status_check;
alter table public.discovery_collection_members
  add constraint dcm_status_check check (status in ('pending', 'accepted'));

create or replace function public.is_collection_member(p_collection_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.discovery_collection_members m
                  where m.collection_id = p_collection_id and m.user_id = p_user_id and m.status = 'accepted');
$$;

create or replace function public.is_collection_invitee(p_collection_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.discovery_collection_members m
                  where m.collection_id = p_collection_id and m.user_id = p_user_id);
$$;
-- Funkcja w polityce = EXECUTE dla kazdej roli czytajacej tabele (regula z migracji 20260916b).
revoke execute on function public.is_collection_invitee(uuid, uuid) from public;
grant execute on function public.is_collection_invitee(uuid, uuid) to anon, authenticated;

create or replace function public.can_read_collection(p_collection_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.discovery_collections c
     where c.id = p_collection_id
       and c.deleted_at is null
       and (
         (c.is_public and not coalesce(c.hidden_by_admin, false) and coalesce(c.moderation_status,'approved') <> 'rejected')
         or c.user_id = p_user_id
         or public.is_collection_invitee(c.id, p_user_id)
       )
  );
$$;

drop policy if exists discovery_collections_member_read on public.discovery_collections;
create policy discovery_collections_member_read on public.discovery_collections for select
  using (deleted_at is null and auth.uid() is not null and public.is_collection_invitee(id, auth.uid()));

drop policy if exists discovery_items_member_read on public.discovery_items;
create policy discovery_items_member_read on public.discovery_items for select
  using (auth.uid() is not null and public.is_collection_invitee(collection_id, auth.uid()));

-- Zaproszenie = wiersz PENDING; do „Zapisane" dopiero po akceptacji.
create or replace function public.add_member_to_collection(p_collection_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_status text;
begin
  if v_uid is null or p_user_id = v_uid then return false; end if;
  -- ⛔ Prywatna lista "Ogolne" (list_status = to_visit) NIE podlega wspoltworzeniu.
  select c.list_status into v_status from public.discovery_collections c
   where c.id = p_collection_id and c.user_id = v_uid and c.deleted_at is null;
  if v_status is null or v_status <> 'visited' then return false; end if;

  insert into public.discovery_collection_members (collection_id, user_id, added_by, status)
  values (p_collection_id, p_user_id, v_uid, 'pending')
  on conflict (collection_id, user_id) do nothing;
  return true;
end; $function$;

create or replace function public.respond_to_collection_invite(p_collection_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_accept then
    update public.discovery_collection_members
       set status = 'accepted'
     where collection_id = p_collection_id and user_id = auth.uid() and status = 'pending';
    if not found then return jsonb_build_object('ok', false, 'reason', 'no_invite'); end if;
    -- Kolekcja ma sie POJAWIC u wspoltworcy bez szukania - do jego "Zapisane".
    insert into public.saved_collections (user_id, collection_id)
    values (auth.uid(), p_collection_id)
    on conflict do nothing;
  else
    delete from public.discovery_collection_members
     where collection_id = p_collection_id and user_id = auth.uid() and status = 'pending';
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke execute on function public.respond_to_collection_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_collection_invite(uuid, boolean) to authenticated;
