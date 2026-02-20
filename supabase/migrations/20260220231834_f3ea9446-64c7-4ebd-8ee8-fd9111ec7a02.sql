
-- Nowe kolumny w routes dla planowania podróży
ALTER TABLE routes ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS pace text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS priorities text[] DEFAULT '{}';

-- Nowe kolumny w pins dla sugerowanego czasu i kategorii
ALTER TABLE pins ADD COLUMN IF NOT EXISTS suggested_time text;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS category text;
