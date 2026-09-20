-- Wylaczenie LEGACY crona push-scheduler (decyzja Nat 2026-09-18).
--
-- Od migracji 20260830 przypomnienia o wyjezdzie robi `enqueue_trip_reminders` (wiersz w
-- notifications -> trigger notify_push -> send-push z adresem `/route/<id>`). Tamta migracja
-- zakladala, ze `cron.schedule` podmieni stary wpis po nazwie - ale nazwy sie roznily
-- (`push-scheduler-morning` vs `trip-reminders-morning`), wiec OBA crony chodzily rownolegle
-- o 7:00 i 17:00 UTC. Stary slal pushe z martwymi adresami (`/day/<id>` = NotFound,
-- `/day-review?route=`, `/review-summary?route=`) dla opublikowanych wyjazdow z data
-- dzis / wczoraj / jutro, bez wiersza w notifications (nie bylo ich w szufladzie).
--
-- Zastosowane na prodzie 2026-09-18 przez Management API (cron.unschedule x2).
-- Funkcja brzegowa `push-scheduler` i `cron_push_scheduler(text)` zostaja jako martwy kod.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-scheduler-morning') THEN PERFORM cron.unschedule('push-scheduler-morning'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-scheduler-evening') THEN PERFORM cron.unschedule('push-scheduler-evening'); END IF;
END $$;
