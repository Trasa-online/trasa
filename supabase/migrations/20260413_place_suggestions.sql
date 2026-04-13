CREATE TABLE IF NOT EXISTS public.place_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_name TEXT NOT NULL,
  city TEXT,
  google_maps_url TEXT,
  suggested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.place_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert suggestions"
  ON public.place_suggestions FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid());
