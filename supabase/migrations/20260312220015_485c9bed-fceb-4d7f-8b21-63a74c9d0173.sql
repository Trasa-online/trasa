
CREATE TABLE public.creator_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_handle TEXT NOT NULL,
  city TEXT NOT NULL,
  place_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  instagram_reel_url TEXT,
  google_maps_url TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_places ENABLE ROW LEVEL SECURITY;

-- Everyone can read active places
CREATE POLICY "Anyone can read active creator places"
  ON public.creator_places
  FOR SELECT
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert creator places"
  ON public.creator_places
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update creator places"
  ON public.creator_places
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete creator places"
  ON public.creator_places
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
