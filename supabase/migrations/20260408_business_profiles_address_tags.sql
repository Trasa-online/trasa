-- Add address and category tags to business_profiles
-- 2026-04-08

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
