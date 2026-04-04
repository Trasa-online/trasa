-- ─── GDPR: profiling consent + user account deletion ─────────────────────────

-- Add profiling consent flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profiling_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS profiling_consent_at TIMESTAMPTZ;

-- Allow users to delete their own account (RODO art. 17 — right to erasure)
-- Deletes the auth.users row; all related data is removed via ON DELETE CASCADE
CREATE OR REPLACE FUNCTION delete_current_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_current_user_account() TO authenticated;
