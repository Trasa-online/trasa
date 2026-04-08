-- Allow businesses to self-register
-- 2026-04-08

-- Add business_name and place_name_text (for businesses not yet in places table)
ALTER TABLE public.business_claims
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS place_name_text TEXT;

-- Make place_id nullable so businesses can register without an existing place entry
ALTER TABLE public.business_claims
  ALTER COLUMN place_id DROP NOT NULL;

-- Allow anyone to insert a claim (they'll create an auth account during registration)
DROP POLICY IF EXISTS "Users can submit claims" ON public.business_claims;
CREATE POLICY "Users can submit claims"
  ON public.business_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
