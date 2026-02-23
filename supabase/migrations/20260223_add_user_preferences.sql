-- Add user preference columns to profiles table
-- onboarding_completed DEFAULT NULL so existing users are not redirected to onboarding;
-- new users have it explicitly set to false during registration, then true after onboarding.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dietary_prefs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_interests text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT null;
