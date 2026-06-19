-- "Skąd jesteś?" w onboardingu - kraj + miasto rodzime usera.
-- Uzywane do logiki "lokals poleca!" w Eksploruj (home_city autora == miasto trasy).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_country text,
  ADD COLUMN IF NOT EXISTS home_city    text;
