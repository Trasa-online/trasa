-- cover_video_url was mistakenly added to business_places — app saves to business_profiles
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS cover_video_url TEXT;
