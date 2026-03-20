-- Journal feature: review narrative/photos on routes + user insights table

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS review_narrative TEXT,
  ADD COLUMN IF NOT EXISTS review_photos TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  insight TEXT NOT NULL,
  source_route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own insights" ON public.user_insights
  FOR ALL USING (user_id = auth.uid());
