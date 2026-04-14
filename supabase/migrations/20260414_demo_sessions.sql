-- Demo mode: allow unauthenticated (anonymous) users to experience the app.

-- 1. Mark sessions as demo
ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- 2. Allow anonymous (authenticated) users to read places
DROP POLICY IF EXISTS "Anyone can read active places" ON public.places;
CREATE POLICY "Anyone can read active places"
  ON public.places FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. Allow anonymous users to create demo sessions
DROP POLICY IF EXISTS "Auth users can create group sessions" ON public.group_sessions;
CREATE POLICY "Auth users can create group sessions"
  ON public.group_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 4. Allow anonymous users to read demo sessions by code (needed before joining)
--    Existing "Auth users can read group sessions" policy already covers this (USING true).

-- 5. Allow anonymous users to react (existing policy uses session membership check)
--    No change needed — join_group_session RPC handles membership.

-- 6. Cleanup: auto-delete demo sessions older than 48h (manual or via cron)
--    For now just index is_demo for efficient queries.
CREATE INDEX IF NOT EXISTS idx_group_sessions_is_demo ON public.group_sessions(is_demo) WHERE is_demo = true;
