-- Add status and match_count columns to group_sessions
-- status: 'active' (default) or 'completed' (set when creator clicks "Zakończ parowanie")
-- match_count: number of selected matched places at session end

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS match_count INT DEFAULT 0;
