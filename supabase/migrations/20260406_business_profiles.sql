CREATE TABLE IF NOT EXISTS public.business_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         UUID REFERENCES public.places(id) ON DELETE CASCADE UNIQUE,
  owner_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name    TEXT NOT NULL,
  logo_url         TEXT,
  cover_image_url  TEXT,
  phone            TEXT,
  email            TEXT,
  website          TEXT,
  booking_url      TEXT,
  description      TEXT,
  opening_hours    JSONB DEFAULT '{}'::jsonb,
  social_links     JSONB DEFAULT '{}'::jsonb,
  is_verified      BOOLEAN DEFAULT false,
  is_premium       BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,
  promo_title      TEXT,
  promo_description TEXT,
  promo_code       TEXT,
  promo_expires_at DATE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id       UUID REFERENCES public.places(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email  TEXT NOT NULL,
  contact_phone  TEXT,
  message        TEXT,
  status         TEXT DEFAULT 'pending',  -- pending | approved | rejected
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_claims    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active business profiles"
  ON public.business_profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Owner can update their profile"
  ON public.business_profiles FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "Admins can manage all profiles"
  ON public.business_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can submit claims"
  ON public.business_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own claims"
  ON public.business_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all claims"
  ON public.business_claims FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
