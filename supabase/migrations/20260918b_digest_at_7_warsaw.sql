-- Raport dzienny o 7:00 czasu polskiego zamiast 9:00 (prosba Nat 2026-09-18).
-- pg_cron liczy w UTC: 5:00 UTC = 7:00 CEST (lato). Zima (CET) ten sam wpis da 6:00 -
-- swiadomie, zeby nie utrzymywac dwoch wpisow; przy zmianie czasu ewentualnie przestawic
-- na '0 6 * * *'. cron.schedule upsertuje po nazwie (jobid 11 zostaje).
-- Zastosowane na prodzie 2026-09-18 przez Management API.
select cron.schedule('daily-analytics-digest', '0 5 * * *', 'select public.cron_daily_analytics_digest();');
