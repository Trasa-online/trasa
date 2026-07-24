-- Okładka wyjazdu wybrana ręcznie przez właściciela (zdjęcie miejsca z trasy).
-- NULL => fallback do pierwszego zdjęcia usera / pierwszego miejsca (jak dotąd).
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.routes.cover_url IS
  'Ręcznie wybrana okładka wyjazdu (URL zdjęcia miejsca). NULL = auto (zdjęcie usera / pierwszego miejsca).';
