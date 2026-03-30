-- Add first_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Add referral tracking to waitlist
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ── referral_codes table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  owner_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  slot         SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  -- filled when someone uses the link to sign up
  used_by_email TEXT,
  used_by_name  TEXT,
  used_at      TIMESTAMPTZ,
  -- filled after admin approves and user creates account
  used_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (owner_id, slot)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Owners can see their own codes
CREATE POLICY "Users read own referral codes"
  ON public.referral_codes FOR SELECT
  USING (owner_id = auth.uid());

-- Unauthenticated reads allowed so JoinPage can display inviter info
CREATE POLICY "Public read referral codes"
  ON public.referral_codes FOR SELECT
  USING (true);

-- ── Trigger: auto-generate 2 codes for every new profile ─────────────────────

CREATE OR REPLACE FUNCTION public.generate_referral_codes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.referral_codes (code, owner_id, slot)
  VALUES
    (encode(gen_random_bytes(5), 'hex'), NEW.id, 1),
    (encode(gen_random_bytes(5), 'hex'), NEW.id, 2)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_referral_codes_on_profile ON public.profiles;
CREATE TRIGGER create_referral_codes_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_codes();

-- ── Back-fill codes for existing users ───────────────────────────────────────

INSERT INTO public.referral_codes (code, owner_id, slot)
SELECT encode(gen_random_bytes(5), 'hex'), id, 1
FROM public.profiles
WHERE id NOT IN (
  SELECT owner_id FROM public.referral_codes WHERE slot = 1
)
ON CONFLICT DO NOTHING;

INSERT INTO public.referral_codes (code, owner_id, slot)
SELECT encode(gen_random_bytes(5), 'hex'), id, 2
FROM public.profiles
WHERE id NOT IN (
  SELECT owner_id FROM public.referral_codes WHERE slot = 2
)
ON CONFLICT DO NOTHING;
