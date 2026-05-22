-- Make handle_new_user resilient: auto-suffix on username collision + populate first_name
-- Bug: signUp z username = juz istniejacy username -> INSERT na profiles fails ->
-- entire auth signUp fails z "Database error saving new user" toast u usera.
-- Plus: trigger nie wstawia first_name z user_metadata, wiec aplikacja musi
-- robic dodatkowy upsert po signUp (czasem timing race, czasem failuje).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  -- Skip anonymous users (zachowuje zachowanie z 20260429_fix_anon_user_trigger.sql)
  IF NEW.is_anonymous THEN
    RETURN NEW;
  END IF;

  -- Derive base username: explicit metadata > email prefix > fallback z UUID
  base_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'user_' || substring(NEW.id::text, 1, 8)
  );

  candidate := base_username;

  -- Append number suffix do az unique. Po 100 probach uzyj UUID slice jako fallback.
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
    IF suffix > 100 THEN
      candidate := base_username || '_' || substring(NEW.id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, username, first_name, avatar_url)
  VALUES (
    NEW.id,
    candidate,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
