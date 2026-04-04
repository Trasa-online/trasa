-- Add optional trip date to group sessions
ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS trip_date DATE;
