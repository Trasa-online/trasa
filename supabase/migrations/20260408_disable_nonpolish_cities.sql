-- Temporarily disable non-Polish cities for user testing
-- 2026-04-08
-- Re-enable with: UPDATE public.places SET is_active = true WHERE city IN ('Budapeszt', 'valletta');

UPDATE public.places SET is_active = false WHERE city = 'Budapeszt';
UPDATE public.places SET is_active = false WHERE city = 'valletta';
