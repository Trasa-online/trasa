-- Glosowanie na miejsca (2026-08-26): kazdy uczestnik moze zaglosowac na miejsce (1 glos/osoba),
-- host widzi liczbe glosow zeby latwiej zdecydowac przy "Wybierz miejsca". RLS jak pin_photos/proposals.
CREATE TABLE IF NOT EXISTS public.place_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  place_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (route_id, place_name, user_id)
);
CREATE INDEX IF NOT EXISTS place_votes_route_idx ON public.place_votes(route_id);
ALTER TABLE public.place_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read place votes" ON public.place_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND (r.user_id = auth.uid() OR r.is_shared = true)));
CREATE POLICY "insert own place vote" ON public.place_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));
CREATE POLICY "delete own place vote" ON public.place_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
