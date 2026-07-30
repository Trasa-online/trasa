-- Trasa "stworzona" = routes.status 'published' (2026-07-30).
-- Regula: zdjecia pinow (pins.images) zasilaja okladki miejsc (fetchPlaceUserPhotos) DOPIERO
-- gdy trasa jest stworzona (status 'published'). Trasa w trakcie tworzenia (status 'draft',
-- ustawiane w createWyjazd) NIE zasila okladek. "Zapisz trase" (ReviewSummary.finishEditing)
-- ustawia status 'published'.
--
-- Backfill: wszystkie istniejace trasy sa juz "stworzone" -> published (inaczej zniknelyby
-- okladki miejsc z dotychczasowych tras, bo wszystkie mialy status 'draft').

UPDATE public.routes
SET status = 'published'
WHERE status IS NULL OR status = 'draft';

-- Indeks pod filtr pipeline'u okladek (pins JOIN routes WHERE status != draft).
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes (status);
