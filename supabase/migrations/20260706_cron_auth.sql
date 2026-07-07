-- =====================================================================
-- Cron auth: funkcje push-scheduler / daily-analytics-digest /
-- monitor-user-threshold maja teraz guard (Authorization: Bearer service_role),
-- bo verify_jwt=false i byly wywolywalne przez kogokolwiek. Przeschedulowujemy
-- crony, zeby przekazywaly service_role (jak dziala trigger waitlista:
-- current_setting('app.settings.service_role_key')).
-- =====================================================================

-- push-scheduler (morning + evening)
select cron.unschedule(jobname) from cron.job where jobname = 'push-scheduler-morning';
select cron.schedule('push-scheduler-morning', '0 7 * * *', $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('window', 'morning')
  );
$$);

select cron.unschedule(jobname) from cron.job where jobname = 'push-scheduler-evening';
select cron.schedule('push-scheduler-evening', '0 17 * * *', $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('window', 'evening')
  );
$$);

-- daily-analytics-digest
select cron.unschedule(jobname) from cron.job where jobname = 'daily-analytics-digest';
select cron.schedule('daily-analytics-digest', '0 7 * * *', $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/daily-analytics-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
$$);

-- monitor-user-threshold
select cron.unschedule(jobname) from cron.job where jobname = 'monitor-user-threshold-daily';
select cron.schedule('monitor-user-threshold-daily', '0 7 * * *', $$
  select net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/monitor-user-threshold',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
$$);
