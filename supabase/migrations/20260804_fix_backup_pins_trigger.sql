-- ============================================================================
-- FIX KRYTYCZNY (2026-08-04): usun martwy trigger backup_pins_before_delete.
-- Tabela pins_backup zostala usunieta w 20260804_cleanup_dead_tables.sql (jako martwa),
-- ale trigger BEFORE DELETE na pins nadal probowal do niej pisac -> KAZDY delete pinu padal.
-- Objaw: aktualizacja/edycja trasy (delete+insert pinow) nie dziala -> "Nie udalo sie zapisac
-- zmian" albo duplikaty pinow (gdy blad byl polykany). Usuwamy trigger + powiazane funkcje.
-- ============================================================================

DROP TRIGGER IF EXISTS backup_pins_before_delete ON public.pins;
DROP FUNCTION IF EXISTS public.backup_pin_before_delete() CASCADE;
DROP FUNCTION IF EXISTS public.restore_pins_from_backup(uuid[], uuid) CASCADE;
