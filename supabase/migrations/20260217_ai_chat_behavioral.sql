-- ══════════════════════════════════════════════════
-- AI Chat + Behavioral Data — Migration
-- ══════════════════════════════════════════════════

-- Routes: add city, chat status, intent, AI outputs
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS chat_status TEXT DEFAULT 'none';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS intent JSONB;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS ai_highlight TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS ai_tip TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS weather_impact TEXT;

-- Pins: plan vs reality
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS planned_order INTEGER;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS realized_order INTEGER;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS was_spontaneous BOOLEAN DEFAULT false;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS was_skipped BOOLEAN DEFAULT false;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Pins: sequential satisfaction
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS sequence_rating TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS sequence_note TEXT;

-- Pins: experience from chat
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS experience_note TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS time_spent TEXT;
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- Chat sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  messages JSONB DEFAULT '[]' NOT NULL,
  current_phase INTEGER DEFAULT 1,
  ai_extracted JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat sessions"
  ON public.chat_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Day deviations
CREATE TABLE IF NOT EXISTS public.day_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  pin_id UUID REFERENCES public.pins(id) ON DELETE SET NULL,
  deviation_type TEXT NOT NULL,
  description TEXT,
  trigger TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_deviations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deviations"
  ON public.day_deviations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.user_id = auth.uid()));

-- Day considerations
CREATE TABLE IF NOT EXISTS public.day_considerations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  place_name TEXT NOT NULL,
  google_place_id TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_considerations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own considerations"
  ON public.day_considerations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.user_id = auth.uid()));
