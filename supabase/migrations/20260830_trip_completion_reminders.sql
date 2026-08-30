-- Przypomnienia o DOKONCZENIU wyjazdu (2026-08-30, prosba Nat).
-- Zmiany wzgledem 20260823c:
--   1. obejmujemy takze wyjazdy W TRAKCIE (trip_type='ongoing'), nie tylko robocze po dacie,
--   2. liczymy KOMPLETNOSC: ile miejsc nie ma zdjecia i ile nie ma notki (zdjecia = priorytet),
--   3. cykl 2x dziennie (rano + wieczor) zamiast raz rano; slot trafia do metadata i do dedupu,
--   4. gdy wszystko uzupelnione -> przypomnienie o PUBLIKACJI ("Zapisz trase").
-- Zrodla tresci per miejsce: pin_photos (zdjecia z autorem, etap "w trakcie") + pins.images
-- (starsze zdjecia per-pin) oraz pin_ratings.note (notki multi-user).
-- Anty-spam: max 1 wpis na wyjazd na SLOT i max 8 przypomnien na wyjazd lacznie.

create or replace function public.enqueue_trip_reminders(p_slot text default 'morning')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  with trip_rows as (
    -- Wyjazdy do przypomnienia: W TRAKCIE (dowolna data) albo ROBOCZY po dacie (+1 / +3 dnia).
    -- Opublikowane odpadaja - tam nie ma czego dokanczac.
    select r.id, r.user_id, r.city, r.trip_type,
           coalesce(r.folder_id, r.id) as trip_key,
           coalesce(r.end_date, r.start_date)::date as day_date,
           coalesce(array_length(r.review_photos, 1), 0) as gallery_count
    from public.routes r
    where coalesce(r.status, 'draft') <> 'published'
      and r.user_id is not null
  ),
  trips as (
    select trip_key,
           max(day_date) as last_date,
           bool_or(trip_type = 'ongoing') as is_ongoing,
           (array_agg(id order by day_date desc nulls last))[1] as rep_route_id,
           (array_agg(user_id))[1] as user_id,
           (array_agg(city) filter (where city is not null))[1] as city,
           max(gallery_count) as gallery_count,
           array_agg(id) as all_ids
    from trip_rows
    group by trip_key
  ),
  scored as (
    select t.*,
           (select count(*) from public.pins p where p.route_id = any(t.all_ids)) as pins_total,
           (select count(*) from public.pins p
             where p.route_id = any(t.all_ids)
               and coalesce(array_length(p.images, 1), 0) = 0
               and not exists (
                 select 1 from public.pin_photos pp
                 where pp.route_id = p.route_id and lower(pp.place_name) = lower(p.place_name)
               )
           ) as missing_photos,
           (select count(*) from public.pins p
             where p.route_id = any(t.all_ids)
               and not exists (
                 select 1 from public.pin_ratings pr
                 where pr.route_id = p.route_id
                   and lower(pr.place_name) = lower(p.place_name)
                   and coalesce(trim(pr.note), '') <> ''
               )
           ) as missing_notes
    from trips t
  )
  insert into public.notifications (user_id, type, actor_id, route_id, metadata)
  select s.user_id, 'trip_reminder'::public.notification_type, s.user_id, s.rep_route_id,
         jsonb_build_object(
           'city', coalesce(s.city, ''),
           'stage', case when s.is_ongoing then 'ongoing' else 'draft' end,
           'slot', p_slot,
           'pins_total', s.pins_total,
           'missing_photos', s.missing_photos,
           'missing_notes', s.missing_notes,
           'gallery_count', s.gallery_count
         )
  from scored s
  where s.pins_total > 0                                   -- pusty wyjazd = nie ma czego dokanczac
    and (
      s.is_ongoing                                          -- W TRAKCIE: przypominamy caly czas
      or s.last_date in (current_date - 1, current_date - 3) -- ROBOCZY po wyjezdzie: +1 i +3 dnia
    )
    and not exists (   -- dedup: 1 wpis na wyjazd na SLOT na dobe
      select 1 from public.notifications n
      where n.user_id = s.user_id
        and n.type = 'trip_reminder'::public.notification_type
        and n.route_id = any(s.all_ids)
        and n.created_at::date = current_date
        and coalesce(n.metadata->>'slot', 'morning') = p_slot
    )
    and (            -- anty-spam: max 8 przypomnien na wyjazd lacznie
      select count(*) from public.notifications n2
      where n2.type = 'trip_reminder'::public.notification_type
        and n2.route_id = any(s.all_ids)
    ) < 8;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Cykl: rano ~9:00 PL (07:00 UTC) i wieczorem ~19:00 PL (17:00 UTC) - te same pory co
-- push-scheduler. cron.schedule upsertuje po nazwie, wiec podmienia stary wpis "morning".
select cron.schedule('trip-reminders-morning', '0 7 * * *',  $$ select public.enqueue_trip_reminders('morning'); $$);
select cron.schedule('trip-reminders-evening', '0 17 * * *', $$ select public.enqueue_trip_reminders('evening'); $$);
