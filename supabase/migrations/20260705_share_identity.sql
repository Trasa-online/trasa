-- Tryb anonimowego udostepniania trasy: user moze udostepnic trase jako Anonim
-- (bez profilu/awatara). Zestawienia obsluguja anonimowosc przez author_name/avatar
-- (juz istnieje) - tu tylko trasy.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS share_anonymous boolean NOT NULL DEFAULT false;
