-- Add main_category and subcategories columns to business_profiles
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS main_category TEXT,
  ADD COLUMN IF NOT EXISTS subcategories TEXT[] DEFAULT '{}';
