-- Bug: pins.visited_at mialo DEFAULT now() (migracja 20260201) - kazdy nowy pin tworzyl sie
-- jako "odwiedzony", przez co tryb "w trakcie trasy" (nastepny przystanek / odhaczanie) nigdy
-- nie mial nieodwiedzonego pinu do pokazania. Pin NIE jest odwiedzony przy tworzeniu.

-- 1. Zdejmij default - nowe piny dostaja NULL (odwiedzony dopiero gdy user odhaczy).
ALTER TABLE public.pins ALTER COLUMN visited_at DROP DEFAULT;

-- 2. Wyzeruj blednie auto-ustawione visited_at (rowne momentowi utworzenia pinu),
--    zachowujac realne odhaczenia (pozniejsze niz utworzenie o > 5 s).
UPDATE public.pins
SET visited_at = NULL
WHERE visited_at IS NOT NULL
  AND created_at IS NOT NULL
  AND abs(extract(epoch FROM (visited_at - created_at))) < 5;
