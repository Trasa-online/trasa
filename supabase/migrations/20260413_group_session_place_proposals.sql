-- Places proposed by members within a group session lobby (before swiping starts)
CREATE TABLE IF NOT EXISTS public.group_session_place_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  place_name TEXT NOT NULL,
  city TEXT,
  proposed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.group_session_place_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members can read proposals"
  ON public.group_session_place_proposals FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can propose places"
  ON public.group_session_place_proposals FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid());
