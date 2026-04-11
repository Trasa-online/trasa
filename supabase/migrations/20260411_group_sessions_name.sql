ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS name TEXT;
