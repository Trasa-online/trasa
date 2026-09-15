-- #5: tagi per-miejsce w listach (jak pins.tags dla tras). Alternatywa dla notki, filtrowalne.
ALTER TABLE public.discovery_items ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
