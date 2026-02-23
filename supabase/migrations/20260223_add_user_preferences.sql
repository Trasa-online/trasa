-- Add user preference columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dietary_prefs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_interests text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
