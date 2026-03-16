-- Enrich creator_plans with social/metadata fields
ALTER TABLE creator_plans
  ADD COLUMN IF NOT EXISTS description          text,
  ADD COLUMN IF NOT EXISTS tags                 text[],
  ADD COLUMN IF NOT EXISTS num_days             int,
  ADD COLUMN IF NOT EXISTS creator_avatar_url   text,
  ADD COLUMN IF NOT EXISTS creator_social_url   text,
  ADD COLUMN IF NOT EXISTS creator_social_platform text; -- 'tiktok' | 'instagram' | 'youtube'

-- Enrich creator_places with ordering and time estimate
ALTER TABLE creator_places
  ADD COLUMN IF NOT EXISTS order_index    int,
  ADD COLUMN IF NOT EXISTS suggested_time text; -- e.g. '1-2h'
