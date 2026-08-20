-- FIX bezpieczenstwa (2026-08-21): widok public.business_profiles_public byl SECURITY DEFINER
-- (Supabase advisor: CRITICAL). Definer omija RLS querying usera. Przywracamy security_invoker=on
-- (jak w 20260804_security_high.sql; cofniete przez _security_high_fix.sql gdy brakowalo
-- publicznej polityki RLS). Teraz business_profiles MA polityke "Anyone can read active
-- business profiles" USING (is_active = true) dla wszystkich rol (w tym anon), wiec widok z
-- invokerem dalej zwraca aktywne wizytowki anonom (widok dodatkowo filtruje is_draft=false).
-- Zero zmian w definicji widoku - tylko flaga.

ALTER VIEW public.business_profiles_public SET (security_invoker = on);
