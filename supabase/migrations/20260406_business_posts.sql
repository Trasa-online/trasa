CREATE TABLE public.business_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID REFERENCES public.places(id) ON DELETE CASCADE,
  description TEXT,
  photo_urls  TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.business_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business posts"
  ON public.business_posts FOR SELECT USING (true);

CREATE POLICY "Business owners can insert posts"
  ON public.business_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE place_id = business_posts.place_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete their posts"
  ON public.business_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE place_id = business_posts.place_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all posts"
  ON public.business_posts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_business_posts_place_id ON public.business_posts(place_id, created_at DESC);
