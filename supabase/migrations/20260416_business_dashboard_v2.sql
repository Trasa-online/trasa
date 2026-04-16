-- Split address into components
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Verification flow
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notified_at TIMESTAMPTZ;

-- All new businesses start on premium
ALTER TABLE public.business_profiles
  ALTER COLUMN is_premium SET DEFAULT true;

-- Policy: owner can read their own profile (needed for notification check)
DROP POLICY IF EXISTS "Owner can read own profile" ON public.business_profiles;
CREATE POLICY "Owner can read own profile"
  ON public.business_profiles FOR SELECT
  USING (owner_user_id = auth.uid());
