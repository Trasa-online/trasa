-- Add experience panel fields to pins
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS place_type TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS core_decision TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS selected_tags TEXT[];
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS timing_tag TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS optional_note TEXT;
