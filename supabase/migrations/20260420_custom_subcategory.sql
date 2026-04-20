ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS custom_subcategory text,
  ADD COLUMN IF NOT EXISTS custom_subcategory_status text DEFAULT 'pending';
