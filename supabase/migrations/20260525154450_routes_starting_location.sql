-- Dodaje punkt startowy do tabeli routes - hotel/nocleg user wybral w
-- StartingLocationPicker (PlanWizard step 3). Trzymamy nazwe + wspolrzedne
-- zeby pokazac specjalny marker 'Start' na mapie trasy + edge function
-- planowania trasy moze brac wspolrzedne pod uwage.

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS starting_location_name TEXT,
  ADD COLUMN IF NOT EXISTS starting_location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS starting_location_lng DOUBLE PRECISION;

COMMENT ON COLUMN routes.starting_location_name IS 'Nazwa punktu startowego (np. nazwa hotelu) wybranego przez uzytkownika w StartingLocationPicker';
COMMENT ON COLUMN routes.starting_location_lat IS 'Szerokosc geograficzna punktu startowego - render marker Start na mapie trasy';
COMMENT ON COLUMN routes.starting_location_lng IS 'Dlugosc geograficzna punktu startowego';
