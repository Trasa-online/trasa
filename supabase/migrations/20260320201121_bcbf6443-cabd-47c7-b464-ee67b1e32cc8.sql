-- Add review columns to routes
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS review_narrative text,
  ADD COLUMN IF NOT EXISTS review_photos text[];

-- Create user_insights table
CREATE TABLE IF NOT EXISTS public.user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  category text NOT NULL,
  insight text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON public.user_insights FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own insights"
  ON public.user_insights FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own insights"
  ON public.user_insights FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());