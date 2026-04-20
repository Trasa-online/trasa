ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS main_category text,
  ADD COLUMN IF NOT EXISTS subcategories text[];
