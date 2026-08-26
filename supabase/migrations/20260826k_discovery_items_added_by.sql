-- Atrybucja pozycji listy (2026-08-26): KTO dodal miejsce. Hak pod przyszle WSPOLTWORZENIE list
-- (dzis tylko wlasciciel dodaje -> added_by = wlasciciel; w przyszlosci wspoltworcy). Additive,
-- nullable - stare pozycje maja NULL (nie da sie odtworzyc autora wstecz, dlatego lapiemy OD TERAZ).
-- Reszta modelu wspoltworzenia (collaborators, per-user notki/zdjecia) - patrz memory
-- project_list_cocreation_architecture; budowana RAZEM z funkcja (RLS lepiej projektowac z UI).
ALTER TABLE public.discovery_items
  ADD COLUMN IF NOT EXISTS added_by uuid;
