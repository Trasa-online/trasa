-- ── 1. pin_ratings: "nie było tego miejsca na trasie" ────────────────────────
ALTER TABLE public.pin_ratings
  ADD COLUMN IF NOT EXISTS not_visited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_visited_reason TEXT;

-- ── 2. routes: tablica użytkowników dla których trasa jest "nowa" ─────────────
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS new_for_users UUID[] DEFAULT '{}';

-- ── 3. RPC: użytkownik odczytuje badge (usuwa siebie z new_for_users) ─────────
CREATE OR REPLACE FUNCTION dismiss_route_badge(p_route_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE routes
  SET new_for_users = array_remove(new_for_users, auth.uid())
  WHERE id = p_route_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_route_badge(UUID) TO authenticated;

-- ── 4. Polityka SELECT: członkowie sesji grupowej widzą trasy grupy ────────────
DROP POLICY IF EXISTS "Group members can see group routes" ON public.routes;
CREATE POLICY "Group members can see group routes"
  ON public.routes FOR SELECT
  USING (
    group_session_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_session_members
      WHERE session_id = routes.group_session_id
        AND user_id = auth.uid()
    )
  );
