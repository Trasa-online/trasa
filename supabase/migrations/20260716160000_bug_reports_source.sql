-- Rozroznienie zrodla zgloszenia: 'user' (appka konsumencka) vs 'business' (panel biznesowy).
-- Panel admina (ops) dzieli zgloszenia na dwie zakladki wg tej kolumny.
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';

-- Backfill: dotychczasowe zgloszenia z panelu biznesowego maja prefix "[Panel biznesowy" w opisie.
UPDATE public.bug_reports
  SET source = 'business'
  WHERE description LIKE '[Panel biznesowy%'
    AND source <> 'business';
