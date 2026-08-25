-- Fix 2026-08-26: cron push-scheduler dostawal 401 (pg_net bez naglowka auth). Teraz wysyla
-- x-trigger-secret (Vault) przez SECURITY DEFINER helper (czyta vault jako owner) + re-schedule.
CREATE OR REPLACE FUNCTION public.cron_push_scheduler(p_window text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  PERFORM net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', COALESCE(v_secret, '')),
    body    := jsonb_build_object('window', p_window)
  );
END; $$;

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('push-scheduler-morning','push-scheduler-evening');
SELECT cron.schedule('push-scheduler-morning', '0 7 * * *',  $$ SELECT public.cron_push_scheduler('morning'); $$);
SELECT cron.schedule('push-scheduler-evening', '0 17 * * *', $$ SELECT public.cron_push_scheduler('evening'); $$);
