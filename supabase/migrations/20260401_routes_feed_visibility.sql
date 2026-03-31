-- Make routes visible on feed by default
-- is_shared repurposed as "visible on feed" toggle
ALTER TABLE public.routes ALTER COLUMN is_shared SET DEFAULT true;
UPDATE public.routes SET is_shared = true WHERE is_shared IS NULL;
