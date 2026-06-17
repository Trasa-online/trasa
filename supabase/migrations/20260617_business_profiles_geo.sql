-- Geokodowane wspolrzedne adresu biznesu.
-- Problem: adres biznesu (business_profiles.street) byl tylko tekstem, a pin na mapie
-- trasy czytal places.latitude/longitude (inne zrodlo, NULL/stare z importu) - pin laduje
-- w zlym miejscu. places UPDATE jest tylko dla admina, wiec wspolrzedne trzymamy tu
-- (wlasciciel moze je zapisac przez swoje RLS), a enrichWithBusinessProfile nadpisuje
-- nimi pozycje pinu.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
