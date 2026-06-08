-- 2026-06-08 — Security cleanup przed App Store:
-- 1) Usuwa nieuzywany feature referrali (wyciekal used_by_email/name przez "Public read")
-- 2) Hardenuje waitliste (publiczny SELECT wyciekal wszystkie maile)

-- ── 1. Usun referrale (kolejnosc: trigger -> funkcja -> tabela -> kolumna) ──
DROP TRIGGER IF EXISTS create_referral_codes_on_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_codes();
DROP TABLE IF EXISTS public.referral_codes CASCADE;
ALTER TABLE public.waitlist DROP COLUMN IF EXISTS referral_code;

-- ── 2. Waitlist: zabierz publiczny odczyt maili, wystaw tylko bezpieczny licznik ──
DROP POLICY IF EXISTS "Anyone can count waitlist entries" ON public.waitlist;

CREATE OR REPLACE FUNCTION public.waitlist_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.waitlist;
$$;

GRANT EXECUTE ON FUNCTION public.waitlist_count() TO anon, authenticated;
