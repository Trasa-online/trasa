-- Draft mode for business profiles created via /biznes/start
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS draft_created_at timestamptz DEFAULT now();

-- Allow authenticated users (including anonymous) to create their own profile
CREATE POLICY "Owner can insert their own profile"
  ON business_profiles FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Allow owner to update their own profile
CREATE POLICY "Owner can update their own profile"
  ON business_profiles FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Track conversion events (business clicked "Zakładam konto")
CREATE TABLE IF NOT EXISTS draft_conversions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES business_profiles(id) ON DELETE CASCADE,
  business_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE draft_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can insert their own conversion"
  ON draft_conversions FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM business_profiles WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read draft conversions"
  ON draft_conversions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
