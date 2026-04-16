-- Track which claim created a business profile (for admin status display)
-- Track when a business owner first activated their account
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES public.business_claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
