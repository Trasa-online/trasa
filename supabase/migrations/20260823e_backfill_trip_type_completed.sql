-- Hygiena trip_type (2026-08-23). Opublikowane trasy (status='published') to wspomnienia
-- (przeszle) - powinny miec trip_type='completed'. Backfill z migracji 20260823d ustawil status
-- na 'published' dla is_shared+cover, ale NIE ruszal trip_type - stad trasy 'published' ze stalym
-- trip_type='planning' (np. "Wyjazd do Pragi"). Wyrownujemy, zeby isMemory (trip_type='completed'
-- || plan_finalized) i filtry aktywnych tras (planning/ongoing) traktowaly je spojnie.
-- Odtad finishEditing ("Zapisz trase") ustawia oba (status='published' + trip_type='completed').
UPDATE public.routes
SET trip_type = 'completed'
WHERE status = 'published'
  AND trip_type IS DISTINCT FROM 'completed';
