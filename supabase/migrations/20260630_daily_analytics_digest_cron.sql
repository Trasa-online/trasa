-- pg_cron + pg_net: codziennie wywołuje daily-analytics-digest edge function.
-- 07:00 UTC = ~9:00 Europe/Warsaw (latem) / 8:00 (zimą) - spójnie z monitor-user-threshold.
-- Edge function sama używa service role z env (cron nie przekazuje tokenu - jak push-scheduler).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotencja: usun stary job jesli istnieje (migracja moze byc re-run safely).
select cron.unschedule(jobname) from cron.job where jobname = 'daily-analytics-digest';

select cron.schedule(
  'daily-analytics-digest',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/daily-analytics-digest',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Verify: powinien zwrocic 1 wiersz, active = true
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-analytics-digest';
