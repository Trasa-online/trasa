-- Supabase Security Advisor (CRITICAL): "Security Definer View" na public.account_directory.
-- Widoki bez security_invoker wykonuja sie z uprawnieniami TWORCY widoku (definer),
-- omijajac RLS pytajacego uzytkownika. Przelaczamy na security_invoker=on, zeby widok
-- respektowal RLS i uprawnienia osoby odpytujacej (zgodnie z wczesniejszym fixem
-- admin_user_stats w 20251127204935).
--
-- account_directory zostal utworzony recznie w Supabase (nie ma go w migracjach),
-- wiec zamiast redefiniowac tresc widoku uzywamy ALTER ... SET, ktory zachowuje
-- definicje. Guard: jesli widoku nie ma (np. swieze srodowisko), pomijamy bez bledu.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'account_directory'
  ) THEN
    EXECUTE 'ALTER VIEW public.account_directory SET (security_invoker = on)';
  END IF;
END $$;
