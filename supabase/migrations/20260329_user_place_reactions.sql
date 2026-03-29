-- User place reactions: track liked/skipped places per user for the taste profile

CREATE TABLE IF NOT EXISTS public.user_place_reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  place_id   UUID        REFERENCES public.places(id) ON DELETE SET NULL,
  place_name TEXT        NOT NULL,
  city       TEXT        NOT NULL,
  category   TEXT,
  photo_url  TEXT,
  reaction   TEXT        NOT NULL CHECK (reaction IN ('liked', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, place_id)
);

ALTER TABLE public.user_place_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reactions"
  ON public.user_place_reactions FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX user_place_reactions_user_city_idx
  ON public.user_place_reactions (user_id, city);
