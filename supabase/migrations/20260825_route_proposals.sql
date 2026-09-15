-- Wspolna PULA PROPOZYCJI miejsc do wyjazdu (route-scoped). Flow (decyzja Nat 2026-08-25):
-- host tworzy wyjazd + dodaje SWOJE miejsca (pins) w arkuszu; zaproszeni uczestnicy dorzucaja
-- PROPOZYCJE tutaj (async, po skonczeniu przez hosta); host promuje wybrane do trasy (pins).
CREATE TABLE IF NOT EXISTS public.route_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  place_name text NOT NULL,
  category text,
  address text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  place_id text,
  google_place_id text,
  description text,
  proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS route_proposals_route_id_idx ON public.route_proposals(route_id);
ALTER TABLE public.route_proposals ENABLE ROW LEVEL SECURITY;

-- Dostep: wlasciciel trasy LUB czlonek sesji grupowej trasy (wzor z 20260828_group_members_edit_pins:
-- route_id -> routes.group_session_id -> group_session_members).
CREATE POLICY "Members read route proposals" ON public.route_proposals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));

-- Insert TYLKO jako self (proposed_by = auth.uid()) i tylko do trasy, do ktorej masz dostep.
CREATE POLICY "Members insert own proposals" ON public.route_proposals FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));

-- Delete: autor propozycji (wycofanie swojej) LUB wlasciciel trasy (odrzucenie / po promocji do pinu).
CREATE POLICY "Proposer or owner delete proposals" ON public.route_proposals FOR DELETE TO authenticated
  USING (
    proposed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.user_id = auth.uid())
  );
