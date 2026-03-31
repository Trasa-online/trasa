-- Fix routes visibility for social feed
--
-- Problem: routes.status defaults to 'draft', and the SELECT policy was:
--   USING (status = 'published' OR user_id = auth.uid())
-- This meant followers could never see each other's routes because routes
-- are never explicitly set to 'published' in the current flow.
--
-- Solution:
-- 1. Drop the old policy
-- 2. New policy: own routes always visible + routes of people you follow
-- 3. Change default status to 'published' (status column kept for MyRoutes UI)
-- 4. Backfill all existing draft routes to published

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Published routes are viewable by everyone" ON public.routes;

-- New policy: logged-in users can see their own routes + routes of people they follow
CREATE POLICY "Routes visible to owner and followers"
  ON public.routes FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.followers
      WHERE follower_id = auth.uid()
        AND following_id = routes.user_id
    )
  );

-- Change default so new routes are immediately visible to followers
ALTER TABLE public.routes ALTER COLUMN status SET DEFAULT 'published';

-- Backfill: make all existing draft routes published
UPDATE public.routes SET status = 'published' WHERE status = 'draft';
