-- Business plan tiers: zero | basic | premium
-- 2026-04-08

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'zero';

-- zero    = name + address only, no detail access from swiper
-- basic   = one cover photo + contact data, no analytics
-- premium = full: logo, gallery, events, posts, analytics
