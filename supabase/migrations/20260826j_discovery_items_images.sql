-- Zdjecia userow per-miejsce na LISCIE (2026-08-26): wlasciciel listy dodaje wlasne zdjecia do
-- miejsca (obok notki short_desc). Tablica URLi w route-images (owner_update RLS juz jest).
ALTER TABLE public.discovery_items
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'::text[];
