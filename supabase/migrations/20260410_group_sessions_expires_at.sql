-- Add expires_at to group_sessions (48h from creation)
-- 2026-04-10

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Back-fill existing rows
UPDATE public.group_sessions
  SET expires_at = created_at + INTERVAL '48 hours'
  WHERE expires_at IS NULL;
