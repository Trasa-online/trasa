-- Crony 'daily-analytics-digest' i 'monitor-user-threshold' leCialy na 401 od dawna.
-- Powod: budowaly naglowek jako
--   'Bearer ' || current_setting('app.settings.service_role_key', true)
-- a to ustawienie na tej bazie NIE ISTNIEJE -> current_setting(...) zwraca NULL, konkatenacja
-- daje NULL, funkcja dostaje pusty Authorization i odpowiada 401. Cron w cron.job_run_details
-- byl przy tym "succeeded" (bo samo net.http_post sie udalo), wiec nic tego nie zglaszalo.
--
-- Naprawa wg wzorca, ktory juz dziala dla pushy (cron_push_scheduler): sekret z Vault
-- wysylany naglowkiem x-trigger-secret. Odporne na rotacje klucza service_role.
-- Funkcje edge przyjmuja teraz x-trigger-secret (deploy 2026-09-01).

CREATE OR REPLACE FUNCTION public.cron_daily_analytics_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  PERFORM net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/daily-analytics-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', COALESCE(v_secret, '')),
    body    := '{}'::jsonb
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.cron_monitor_user_threshold()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  PERFORM net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/monitor-user-threshold',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', COALESCE(v_secret, '')),
    body    := '{}'::jsonb
  );
END; $function$;

SELECT cron.alter_job(11, command := 'select public.cron_daily_analytics_digest();');
SELECT cron.alter_job(12, command := 'select public.cron_monitor_user_threshold();');
