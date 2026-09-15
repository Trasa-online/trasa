-- Enum 'trip_reminder' (przypomnienie o dokonczeniu roboczego wyjazdu).
-- APLIKOWANE OSOBNO (przed reszta) przez Management API - ADD VALUE nie moze byc w tej samej
-- transakcji co jego uzycie (notify_push branch / enqueue_trip_reminders ponizej).
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'trip_reminder';
