-- Category-based swiping: replace rounds with per-category queues
-- Each session stores an ordered list of categories; members swipe 15 places per category.

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_category_index INT DEFAULT 0;

ALTER TABLE public.group_session_members
  ADD COLUMN IF NOT EXISTS categories_done TEXT[] DEFAULT '{}';
