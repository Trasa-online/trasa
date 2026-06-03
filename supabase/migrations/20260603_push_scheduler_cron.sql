-- pg_cron + pg_net: 2x dziennie wywołuje push-scheduler edge function.
-- Morning (7:00 UTC = ~9:00 PL latem / 8:00 PL zimą): review wczorajszej trasy + active today
-- Evening (17:00 UTC = ~19:00 PL latem / 18:00 PL zimą): trip preview na jutro
--
-- Push-scheduler edge function odbiera body { "window": "morning" | "evening" } i filtruje typy push.
-- Jeśli brak Authorization header w request, edge function sama używa service role key z env -
-- cron nie musi przekazywać tokenu (lepsze bezpieczeństwo, brak hardcoded credentials w cron).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Usun stare zaplanowane joby (idempotencja - migracja moze byc re-run safely)
select cron.unschedule(jobname) from cron.job where jobname in (
  'push-scheduler-morning',
  'push-scheduler-evening',
  'push-scheduler-daily'  -- legacy, jesli istnial
);

-- Morning: 7:00 UTC daily
select cron.schedule(
  'push-scheduler-morning',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('window', 'morning')
  ) as request_id;
  $$
);

-- Evening: 17:00 UTC daily
select cron.schedule(
  'push-scheduler-evening',
  '0 17 * * *',
  $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('window', 'evening')
  ) as request_id;
  $$
);

-- Verify: powinien zwrócić 2 wiersze
select jobid, jobname, schedule, active from cron.job
where jobname in ('push-scheduler-morning', 'push-scheduler-evening')
order by jobname;
