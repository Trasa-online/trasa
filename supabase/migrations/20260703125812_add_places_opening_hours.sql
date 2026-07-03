-- Godziny otwarcia miejsc z Google Places (backfill jednorazowy + odswiezane w razie potrzeby).
-- Ksztalt JSONB: { "weekday_text": string[7] (PL), "periods": [{open:{day,time}, close:{day,time}}...] }
-- Dzieki temu planer (heurystyka H5) i wizytowka czytaja godziny z bazy, bez odpytywania Google.
alter table public.places add column if not exists opening_hours jsonb;
comment on column public.places.opening_hours is 'Google Places opening_hours: { weekday_text, periods }. Backfill + refresh.';
