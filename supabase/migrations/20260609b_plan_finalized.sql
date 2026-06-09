-- Po minięciu daty trasy user moze poprawic plan dnia (usun/reorder), a po
-- kliknieciu "Zapisz plan dnia" plan jest zamrazany (read-only) i mozna go
-- udostepnic. Flaga per route (per dzien trasy wielodniowej).
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS plan_finalized boolean DEFAULT false;
