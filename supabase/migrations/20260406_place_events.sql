CREATE TABLE IF NOT EXISTS public.place_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   UUID REFERENCES public.places(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'view' | 'click_phone' | 'click_website' | 'click_booking' | 'add_to_route'
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.place_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert events"
  ON public.place_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Business owners can read events for their place"
  ON public.place_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.business_profiles
    WHERE business_profiles.place_id = place_events.place_id
      AND business_profiles.owner_user_id = auth.uid()
  ));
CREATE POLICY "Admins can read all events"
  ON public.place_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_place_events_place_id_created ON public.place_events(place_id, created_at DESC);
