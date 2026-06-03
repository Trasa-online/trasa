-- =============================================================================
-- Bug fix 2026-06-02: profile NIE jest tworzony gdy user upgraduje z anon→OAuth
-- =============================================================================
-- Aplikacja używa Supabase Anonymous Auth (signInAnonymously) jako default na
-- iOS Capacitor - user może korzystać przed pełnym sign-up.
--
-- Trigger handle_new_user (migracja 20251116145845) tworzy profile przy INSERT
-- do auth.users. W 20260429_fix_anon_user_trigger.sql dodano SKIP dla
-- is_anonymous=true (anon nie ma email -> NULL username -> NOT NULL violation).
--
-- ALE - gdy user upgraduje anon -> OAuth (Google/Apple), to jest UPDATE auth.users
-- (zmiana is_anonymous z true na false + dodanie email), NIE INSERT.
-- Trigger AFTER INSERT się nie odpala -> profile NIE jest tworzone.
--
-- Skutek: user z OAuth ma auth.users record ale brak profiles record. Foreign
-- key constraints (group_session_members.user_id REFERENCES profiles(id))
-- failują przy próbie dołączenia do group session.
--
-- Fix dwustronnie:
-- 1. Backfill - utwórz profiles dla wszystkich nie-anon users bez profilu
-- 2. Nowy trigger AFTER UPDATE - łapie upgrade anon->OAuth

-- ── 1. Backfill profiles dla istniejących userów bez profilu ─────────────────
INSERT INTO public.profiles (id, username, avatar_url)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'username',
    u.raw_user_meta_data->>'first_name',
    split_part(u.email, '@', 1),
    'user-' || substr(u.id::text, 1, 8)
  ) as username,
  u.raw_user_meta_data->>'avatar_url' as avatar_url
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL AND u.is_anonymous = false
ON CONFLICT (id) DO NOTHING;

-- ── 2. Trigger AFTER UPDATE auth.users - upgrade anon→OAuth tworzy profile ──
CREATE OR REPLACE FUNCTION public.handle_user_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Łapiemy 2 scenariusze:
  --   a) User był anon (OLD.is_anonymous=true), upgraduje do real account
  --   b) User nie miał email (OLD.email IS NULL), dostaje email przez OAuth
  IF NEW.is_anonymous = false AND (
    OLD.is_anonymous = true
    OR (OLD.email IS NULL AND NEW.email IS NOT NULL)
  ) THEN
    INSERT INTO public.profiles (id, username, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'first_name',
        split_part(NEW.email, '@', 1),
        'user-' || substr(NEW.id::text, 1, 8)
      ),
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_upgrade ON auth.users;
CREATE TRIGGER on_user_upgrade
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_upgrade();
