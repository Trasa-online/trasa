-- Tagi TRASY (cała trasa) - predefiniowana pula wybierana w ReviewSummary.
-- Per-miejsce tagi używają istniejącej kolumny pins.tags (już w schemacie).
-- Wyświetlane na karcie trasy w eksploracji; docelowo filtrowalne.
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
