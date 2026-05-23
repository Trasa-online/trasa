-- RPC: ensure_current_user_profile()
-- Tworzy row w profiles dla aktualnie zalogowanego usera jezeli nie istnieje.
-- Uzywane defensywnie z klienta przed insertem do tabel ktore maja FK do profiles
-- (np. group_sessions.created_by, group_session_members.user_id).
--
-- Pomimo trigger handle_new_user kt(ry powinien tworzyc profile, byly przypadki
-- gdzie row sie nie tworzyl (np. username collision pre-20260601_handle_new_user_resilient,
-- OAuth signup z mismatched user_id). Ta funkcja dziala jako safety net.

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_meta JSONB;
  v_base_username TEXT;
  v_candidate TEXT;
  v_suffix INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Already exists - quick return
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RETURN v_user_id;
  END IF;

  -- Fetch user data from auth.users
  SELECT email, raw_user_meta_data
    INTO v_email, v_meta
  FROM auth.users
  WHERE id = v_user_id;

  -- Derive base username: explicit metadata > email prefix > uuid fallback
  v_base_username := COALESCE(
    NULLIF(v_meta->>'username', ''),
    NULLIF(v_meta->>'first_name', ''),
    NULLIF(split_part(v_email, '@', 1), ''),
    'user_' || substring(v_user_id::text, 1, 8)
  );

  v_candidate := v_base_username;

  -- Suffix loop on unique collision
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_candidate) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base_username || v_suffix::text;
    IF v_suffix > 100 THEN
      v_candidate := v_base_username || '_' || substring(v_user_id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, username, first_name, avatar_url)
  VALUES (
    v_user_id,
    v_candidate,
    NULLIF(v_meta->>'first_name', ''),
    NULLIF(v_meta->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pozwol authenticated userom wywolac
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;
