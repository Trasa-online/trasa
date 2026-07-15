-- Modul moderacji (panel ops): status moderacji wizytowek biznesowych.
-- Self-service rejestracja tworzy business_profiles (is_active=false) czekajace
-- na akcept foundera. Kolejka moderacji = moderation_status='pending'.

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id);

-- CHECK na dozwolone wartosci (idempotentnie).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_profiles_moderation_status_check'
  ) THEN
    ALTER TABLE public.business_profiles
      ADD CONSTRAINT business_profiles_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Backfill istniejacych: zweryfikowane/aktywne juz "przeszly" -> approved,
-- reszta -> pending (trafia do kolejki). Drafty pomijamy (jeszcze nie zgloszone).
UPDATE public.business_profiles
SET moderation_status = CASE
  WHEN is_verified = true OR is_active = true THEN 'approved'
  ELSE 'pending'
END
WHERE is_draft = false;

-- Drafty: nie w kolejce dopoki nie dokoncza rejestracji.
UPDATE public.business_profiles
SET moderation_status = 'pending'
WHERE is_draft = true;

CREATE INDEX IF NOT EXISTS idx_business_profiles_moderation_status
  ON public.business_profiles (moderation_status);
