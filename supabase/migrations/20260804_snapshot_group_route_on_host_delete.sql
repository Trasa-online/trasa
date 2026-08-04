-- ============================================================================
-- Faza 4 tras grupowych (2026-08-04): host usuwa trase/konto -> KOPIE u uczestnikow.
-- Gdy usuwana jest trasa HOSTA podpieta do sesji grupowej, kazdy uczestnik dostaje
-- WLASNA kopie (solo, prywatna) z pinami, swoimi notkami i wspolnymi zdjeciami.
-- Trigger BEFORE DELETE + SECURITY DEFINER. Cala logika owinieta w EXCEPTION, zeby
-- blad kopiowania NIGDY nie zablokowal usuniecia trasy (lekcja z pins_backup).
-- Odpala sie tez przy kaskadowym usuwaniu tras podczas kasowania konta hosta.
-- ============================================================================

create or replace function public.snapshot_group_route_on_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_member uuid; v_new uuid; v_host uuid;
begin
  if OLD.group_session_id is null then return OLD; end if;
  select created_by into v_host from public.group_sessions where id = OLD.group_session_id;
  -- Snapshot TYLKO gdy usuwana jest trasa HOSTA (nie kopia uczestnika).
  if v_host is null or OLD.user_id <> v_host then return OLD; end if;

  begin
    for v_member in
      select gsm.user_id from public.group_session_members gsm
      where gsm.session_id = OLD.group_session_id and gsm.user_id <> OLD.user_id
    loop
      insert into public.routes (
        user_id, title, city, trip_type, status, day_number, is_shared,
        list_cover_url, cover_url, start_date, end_date, group_session_id,
        ai_summary, ai_highlight, review_narrative, review_photos
      ) values (
        v_member, OLD.title, OLD.city, OLD.trip_type, OLD.status, OLD.day_number, false,
        OLD.list_cover_url, OLD.cover_url, OLD.start_date, OLD.end_date, null,
        OLD.ai_summary, OLD.ai_highlight, OLD.review_narrative,
        coalesce(OLD.review_photos, '{}') ||
          coalesce((select array_agg(url) from public.group_trip_photos where session_id = OLD.group_session_id), '{}')
      ) returning id into v_new;

      -- Piny
      insert into public.pins (
        route_id, place_name, address, description, category, latitude, longitude,
        place_id, suggested_time, photo_url, pin_order, original_creator_id
      )
      select v_new, place_name, address, description, category, latitude, longitude,
             place_id, suggested_time, photo_url, pin_order, coalesce(original_creator_id, OLD.user_id)
      from public.pins where route_id = OLD.id;

      -- Notki uczestnika (pin_ratings przypiete do trasy hosta) -> na jego kopie.
      insert into public.pin_ratings (route_id, user_id, place_name, note, is_highlight, not_visited, not_visited_reason)
      select v_new, user_id, place_name, note, is_highlight, not_visited, not_visited_reason
      from public.pin_ratings where route_id = OLD.id and user_id = v_member;
    end loop;
  exception when others then
    null; -- NIGDY nie blokuj usuniecia trasy przez blad kopiowania.
  end;

  return OLD;
end;
$$;

drop trigger if exists snapshot_group_route_before_delete on public.routes;
create trigger snapshot_group_route_before_delete
  before delete on public.routes
  for each row execute function public.snapshot_group_route_on_delete();
