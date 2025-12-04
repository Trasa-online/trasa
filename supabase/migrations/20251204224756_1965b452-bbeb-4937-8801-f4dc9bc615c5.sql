-- Create table for tracking route completions (users who walked/completed a route)
CREATE TABLE public.route_completions (
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

-- Enable RLS
ALTER TABLE public.route_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Route completions are viewable by everyone"
ON public.route_completions
FOR SELECT
USING (true);

CREATE POLICY "Users can mark routes as completed"
ON public.route_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark route completion"
ON public.route_completions
FOR DELETE
USING (auth.uid() = user_id);