-- Zdjecia per-miejsce z AUTOREM (etap "w trakcie", 2026-08-26): kazdy uczestnik dodaje zdjecia do
-- miejsca, przy zdjeciu widnieje awatar osoby ktora je dodala. pins.images = text[] bez autora,
-- group_trip_photos = tylko grupowe (session_id NOT NULL). pin_photos dziala solo i grupowo.
CREATE TABLE IF NOT EXISTS public.pin_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  place_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pin_photos_route_idx ON public.pin_photos(route_id);
ALTER TABLE public.pin_photos ENABLE ROW LEVEL SECURITY;

-- Read: wlasciciel trasy LUB (trasa is_shared) - zgodnie z reszta (pin_ratings/route_proposals).
CREATE POLICY "read pin photos" ON public.pin_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND (r.user_id = auth.uid() OR r.is_shared = true)));

-- Insert TYLKO jako self, do trasy do ktorej masz dostep (wlasciciel lub czlonek sesji grupowej).
CREATE POLICY "insert own pin photos" ON public.pin_photos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND (
      r.user_id = auth.uid()
      OR (r.group_session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_session_members m WHERE m.session_id = r.group_session_id AND m.user_id = auth.uid()))
    )));

-- Delete: autor zdjecia LUB wlasciciel trasy.
CREATE POLICY "delete own or owner pin photos" ON public.pin_photos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.user_id = auth.uid()));
