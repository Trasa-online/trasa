
-- Add review fields to pins table
ALTER TABLE public.pins
ADD COLUMN expectation_met text,
ADD COLUMN pros text[] DEFAULT '{}'::text[],
ADD COLUMN cons text[] DEFAULT '{}'::text[],
ADD COLUMN trip_role text,
ADD COLUMN one_liner text,
ADD COLUMN recommended_for text[] DEFAULT '{}'::text[];

-- Add the same columns to pins_backup for consistency
ALTER TABLE public.pins_backup
ADD COLUMN expectation_met text,
ADD COLUMN pros text[] DEFAULT '{}'::text[],
ADD COLUMN cons text[] DEFAULT '{}'::text[],
ADD COLUMN trip_role text,
ADD COLUMN one_liner text,
ADD COLUMN recommended_for text[] DEFAULT '{}'::text[];
