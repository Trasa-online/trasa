-- Allow anonymous claim submissions (no auth account needed upfront)
-- Admin invites the business owner after reviewing the claim

-- Make user_id nullable so we can insert without an auth account
ALTER TABLE public.business_claims
  ALTER COLUMN user_id DROP NOT NULL;

-- Replace policy: allow anyone to insert a claim
DROP POLICY IF EXISTS "Users can submit claims" ON public.business_claims;
CREATE POLICY "Anyone can submit a business claim"
  ON public.business_claims FOR INSERT WITH CHECK (true);
