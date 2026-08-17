-- #5: okladki Google dla miejsc w listach (przez cache-place-photo -> Storage, 1 fetch/miejsce,
-- plik wspoldzielony miedzy listami/userami). Edge function persistuje URL do discovery_items,
-- wiec potrzebuje kolumny photo_cached_at (spojnie z pins/places). Additywne, bezpieczne.
ALTER TABLE public.discovery_items
  ADD COLUMN IF NOT EXISTS photo_cached_at TIMESTAMPTZ;
