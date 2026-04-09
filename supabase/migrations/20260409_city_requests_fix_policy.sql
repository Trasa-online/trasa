-- Fix city_requests INSERT policy:
-- The original policy checked auth.uid() = user_id, but NULL = NULL is NULL (not TRUE) in PostgreSQL,
-- so anonymous users (user_id = NULL) were silently blocked.
-- 2026-04-09

DROP POLICY IF EXISTS "Users can insert city requests" ON public.city_requests;

CREATE POLICY "Anyone can insert city requests"
  ON public.city_requests FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
