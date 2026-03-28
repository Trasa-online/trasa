-- Migration: route_examples table for human-curated AI training examples
-- 2026-03-28

CREATE TABLE IF NOT EXISTS public.route_examples (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  city             TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  personality_type TEXT        NOT NULL,  -- kulturalny, kawiarniany, nocny, aktywny, zakupowy, historyczny, mix
  description      TEXT,                  -- what makes this route special
  pins             JSONB       NOT NULL DEFAULT '[]',
  -- pins format: [{place_name, suggested_time, duration_minutes, walking_time_from_prev, category, note}]
  day_metrics      JSONB,                 -- {walking_km, crowd_level, energy_cost}
  is_approved      BOOLEAN     DEFAULT false,
  is_rejected      BOOLEAN     DEFAULT false,
  evaluator_notes  TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.route_examples ENABLE ROW LEVEL SECURITY;

-- Only service role can write; authenticated users can read approved ones
CREATE POLICY "Anyone can read approved route examples"
  ON public.route_examples FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Service role full access"
  ON public.route_examples FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX route_examples_city_idx ON public.route_examples (city);
CREATE INDEX route_examples_approved_idx ON public.route_examples (is_approved);
CREATE INDEX route_examples_personality_idx ON public.route_examples (personality_type);
