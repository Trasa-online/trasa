-- Nowy typ powiadomienia: gwiazdka od uczestnika w mojej kolekcji (2026-09-20).
-- ADD VALUE osobno - enum nie moze byc uzyty w tej samej transakcji, w ktorej powstal.
alter type public.notification_type add value if not exists 'list_starred';
