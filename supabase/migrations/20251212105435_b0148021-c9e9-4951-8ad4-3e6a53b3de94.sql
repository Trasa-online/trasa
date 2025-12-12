-- Add name_translations column to pins table for multilingual search
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;

-- Add index for faster JSONB text search
CREATE INDEX IF NOT EXISTS idx_pins_name_translations ON public.pins USING GIN (name_translations);