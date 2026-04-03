-- ─── group_session_rounds ────────────────────────────────────────────────────
-- One row per round per session. All members of the session see the
-- same place_ids in the same order for a given round.

CREATE TABLE public.group_session_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  round_number  INT  NOT NULL DEFAULT 1,
  place_ids     UUID[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'voting', 'completed')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, round_number)
);

ALTER TABLE public.group_session_rounds ENABLE ROW LEVEL SECURITY;

-- Members of a session can read its rounds
CREATE POLICY "Session members can view rounds"
  ON public.group_session_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_session_members
      WHERE session_id = group_session_rounds.session_id
        AND user_id = auth.uid()
    )
  );

-- ─── Extend group_session_members ─────────────────────────────────────────────

ALTER TABLE public.group_session_members
  ADD COLUMN IF NOT EXISTS current_round_done  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_round_vote  TEXT
    CHECK (current_round_vote IN ('continue', 'finish', 'opt_out')),
  ADD COLUMN IF NOT EXISTS swiping_active      BOOLEAN DEFAULT true;
