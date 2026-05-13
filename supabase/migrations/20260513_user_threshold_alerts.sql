-- =====================================================================
-- User threshold alerts: tabela + pg_cron schedule
-- =====================================================================
-- Cele:
--  1. Trackować które progi powiadomień zostały wysłane (idempotentność)
--  2. Cron job wywołuje monitor-user-threshold codziennie o 9:00 (Europe/Warsaw)
--  3. Po przekroczeniu progu 1001 użytkowników: wyłączyć cache zdjęć
-- =====================================================================

-- ── 1. Tabela alertów ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cache_threshold_alerts (
  threshold              INT          PRIMARY KEY,
  triggered_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  user_count_at_trigger  INT          NOT NULL
);

ALTER TABLE public.cache_threshold_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage threshold alerts" ON public.cache_threshold_alerts;
CREATE POLICY "Service role can manage threshold alerts"
  ON public.cache_threshold_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. pg_cron schedule (wymaga rozszerzenia pg_cron + pg_net) ───────
-- Cron uruchamia HTTP request do edge function codziennie o 09:00 Europe/Warsaw
-- (= 07:00 UTC w lecie / 08:00 UTC w zimie — przybliżenie cron'a UTC)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Usuń istniejące zadanie jeśli było (idempotentność)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'monitor-user-threshold-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Zaplanuj nowe (codziennie 07:00 UTC = 09:00 Europe/Warsaw w lecie)
-- UWAGA: po pierwszym deploymencie ustaw SUPABASE_URL i SUPABASE_ANON_KEY w pg config,
-- albo zaktualizuj ten cron z prawdziwymi wartościami (sekcja na końcu pliku).
SELECT cron.schedule(
  'monitor-user-threshold-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/monitor-user-threshold',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  $$
);
