
-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create user_memory table
CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  day_number INTEGER,
  city TEXT,
  content TEXT NOT NULL,
  embedding TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, route_id)
);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories" ON public.user_memory
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memories" ON public.user_memory
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories" ON public.user_memory
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memories" ON public.user_memory
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Service role needs access for edge functions
CREATE POLICY "Service role full access to user_memory" ON public.user_memory
  FOR ALL USING (true) WITH CHECK (true);

-- Create user_preference_graph table
CREATE TABLE IF NOT EXISTS public.user_preference_graph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, preference_key)
);

ALTER TABLE public.user_preference_graph ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preference_graph
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON public.user_preference_graph
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON public.user_preference_graph
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences" ON public.user_preference_graph
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Service role needs access for edge functions
CREATE POLICY "Service role full access to user_preference_graph" ON public.user_preference_graph
  FOR ALL USING (true) WITH CHECK (true);
