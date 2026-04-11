-- Pin ratings (1-5 stars per place + one highlight "6th star")
CREATE TABLE IF NOT EXISTS public.pin_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  is_highlight BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, user_id, place_name)
);
ALTER TABLE public.pin_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pin ratings" ON public.pin_ratings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can read pin ratings" ON public.pin_ratings
  FOR SELECT USING (true);

-- Overall route rating
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5);
