-- FIX push: rejestracja tokenu APNs upsertuje z onConflict "user_id,apns_token",
-- ale jedyny pasujacy indeks byl CZESCIOWY (WHERE apns_token IS NOT NULL).
-- Postgres nie moze uzyc partial index jako arbitra ON CONFLICT bez predykatu
-- (ktorego supabase-js nie wysyla) -> upsert padal (42P10), token sie nie zapisywal
-- -> brak subskrypcji -> zaden push nie dochodzil.
-- Zamieniamy na pelny unikalny indeks (NULL-e sa rozroznialne, wiersze web z
-- apns_token=NULL nie koliduja).

DROP INDEX IF EXISTS public.push_sub_user_apns_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS push_sub_user_apns_uniq
  ON public.push_subscriptions(user_id, apns_token);
