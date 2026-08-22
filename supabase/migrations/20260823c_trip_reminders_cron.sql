-- Przypomnienia o dokonczeniu roboczego wyjazdu (2026-08-23).
-- "Przeszly" = OPUBLIKOWANY ("Zapisz trase" -> status='published'), NIE miniety wg daty. Roboczy
-- wyjazd (status='draft') po dacie NIE staje sie automatycznie wspomnieniem - dlatego nudzimy usera
-- 2x: dzien +1 i +3 po wyjezdzie, zeby dodal zdjecia/notki/okladke i opublikowal. Kanal: insert do
-- notifications -> trigger notify_push -> push (telefon) + dzwonek in-app. Adresat = wlasciciel
-- (routes.user_id); actor_id = self (kolumna NOT NULL, jak collection_approved).
-- Wymaga: enum 'trip_reminder' (migracja a) + galaz w notify_push (migracja b).

create or replace function public.enqueue_trip_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Jeden wpis na LOGICZNY wyjazd (folder_id albo id), nie na kazdy dzien - inaczej trasa
  -- wielodniowa dostaje kilka przypomnien tego samego ranka. Reprezentant = ostatni dzien.
  with trip_rows as (
    select r.id, r.user_id, r.city,
           coalesce(r.folder_id, r.id) as trip_key,
           coalesce(r.end_date, r.start_date)::date as day_date
    from public.routes r
    where coalesce(r.status, 'draft') = 'draft'   -- roboczy (niepublikowany)
  ),
  trips as (
    select trip_key,
           max(day_date) as last_date,
           (array_agg(id order by day_date desc nulls last))[1] as rep_route_id,
           (array_agg(user_id))[1] as user_id,
           (array_agg(city) filter (where city is not null))[1] as city,
           array_agg(id) as all_ids
    from trip_rows
    group by trip_key
  )
  insert into public.notifications (user_id, type, actor_id, route_id, metadata)
  select t.user_id, 'trip_reminder'::public.notification_type, t.user_id, t.rep_route_id,
         jsonb_build_object('city', coalesce(t.city, ''))
  from trips t
  where t.last_date in (current_date - 1, current_date - 3)   -- +1 i +3 dnia po wyjezdzie
    and t.user_id is not null
    and exists (select 1 from public.pins p where p.route_id = any(t.all_ids))  -- ma >=1 miejsce
    and not exists (   -- dedup: max 1 przypomnienie na wyjazd na dobe
      select 1 from public.notifications n
      where n.user_id = t.user_id
        and n.type = 'trip_reminder'::public.notification_type
        and n.route_id = any(t.all_ids)
        and n.created_at::date = current_date
    );
end;
$$;

-- Cron: codziennie ~9 rano PL (07:00 UTC, jak push-scheduler-morning). cron.schedule upsertuje po nazwie.
select cron.schedule('trip-reminders-morning', '0 7 * * *', $$ select public.enqueue_trip_reminders(); $$);
