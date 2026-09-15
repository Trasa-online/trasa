-- Kto DODAL dane miejsce do wyjazdu (etap propozycji): awatar uczestnika na miniaturce + sprawdzanie
-- kto jeszcze nie dodal propozycji (2026-08-26). original_creator_id = "odkrywca lokacji" (inny sens),
-- wiec osobna kolumna added_by. Nullable (stare piny bez autora).
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
