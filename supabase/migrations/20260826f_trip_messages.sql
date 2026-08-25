-- Czat wyjazdu (2026-08-26): uczestnicy przegaduja miejsca bezposrednio na widoku wyjazdu.
-- Dymek czatu na SharedRoute -> arkusz z wiadomosciami (realtime). RLS: uczestnicy (owner/is_shared).
CREATE TABLE IF NOT EXISTS public.trip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_messages_route_idx ON public.trip_messages(route_id, created_at);
ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read trip messages" ON public.trip_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND (r.user_id = auth.uid() OR r.is_shared = true)));
CREATE POLICY "insert own trip message" ON public.trip_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));
CREATE POLICY "delete own trip message" ON public.trip_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime (live wiadomosci).
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
