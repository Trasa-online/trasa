-- Rate limiting table for AI edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint  TEXT    NOT NULL,
  count     INT     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, endpoint)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own limits (read-only; writes go through service role)
CREATE POLICY "Users read own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);
