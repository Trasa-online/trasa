
-- Fix overly permissive service role policies
DROP POLICY IF EXISTS "Service role full access to user_memory" ON public.user_memory;
DROP POLICY IF EXISTS "Service role full access to user_preference_graph" ON public.user_preference_graph;

-- Service role bypasses RLS by default, so these policies are not needed.
-- The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically.
