-- BACKFILL: dla istniejacych auth.users bez profile row, stworz je teraz.
-- Naprawia historyczne dane (OAuth users z pre-20260601 trigger period, anon converts
-- ktorzy hit username collision, etc.). Bez tego globalny safety net w useAuth dziala
-- tylko dla nowych sessionów - istniejacy zalogowany user wymaga ponownego logowania
-- aby trigger sie odpalal.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING. Bezpieczne do re-run.
-- Skip anon users (zachowanie zgodne z handle_new_user trigger).

DO $$
DECLARE
  r RECORD;
  v_base_username TEXT;
  v_candidate TEXT;
  v_suffix INT;
  v_inserted INT := 0;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
      AND COALESCE(u.is_anonymous, false) = false
  LOOP
    v_base_username := COALESCE(
      NULLIF(r.raw_user_meta_data->>'username', ''),
      NULLIF(r.raw_user_meta_data->>'first_name', ''),
      NULLIF(split_part(r.email, '@', 1), ''),
      'user_' || substring(r.id::text, 1, 8)
    );

    v_candidate := v_base_username;
    v_suffix := 0;

    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_candidate) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := v_base_username || v_suffix::text;
      IF v_suffix > 100 THEN
        v_candidate := v_base_username || '_' || substring(r.id::text, 1, 8);
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.profiles (id, username, first_name, avatar_url)
    VALUES (
      r.id,
      v_candidate,
      NULLIF(r.raw_user_meta_data->>'first_name', ''),
      NULLIF(r.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % missing profile rows', v_inserted;
END $$;
