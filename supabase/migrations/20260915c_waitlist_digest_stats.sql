-- Waitlista w codziennym raporcie (prosba Nat 2026-09-15: "od teraz aktualizuj codziennie
-- waitliste"). Raport dzienny (`daily-analytics-digest`) leci z pg_cron jako service_role,
-- wiec NIE moze skorzystac z `admin_waitlist_peek` - tamta funkcja pyta o `auth.uid()`
-- i role 'admin', a wywolanie z crona nie ma zadnego uzytkownika.
--
-- Stad osobna funkcja tylko do raportu: te same liczby, inna bramka.
--
-- ⚠️ Zwraca ADRESY E-MAIL, wiec `EXECUTE` dostaje WYLACZNIE `service_role`. Supabase nadaje
-- EXECUTE roli `anon` z automatu, a samo `revoke from public` tego NIE zdejmuje - dlatego
-- jawny revoke dla public, anon i authenticated (patrz audyt 20260914c).

create or replace function public.waitlist_digest_stats(p_limit int default 10)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_waiting   bigint;
  v_converted bigint;
  v_new24     bigint;
  v_rows      jsonb;
begin
  -- "Czeka" = zapis bez konta w auth.users. Osoba, ktora juz zalozyla konto, nie czeka
  -- na premiere - i to jest jedyna liczba, ktora cos mowi o wielkosci listy.
  select count(*) filter (where u.id is null),
         count(*) filter (where u.id is not null),
         count(*) filter (where u.id is null and w.created_at >= now() - interval '24 hours')
    into v_waiting, v_converted, v_new24
  from public.waitlist w
  left join auth.users u on lower(u.email) = lower(w.email);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select w.email, w.created_at, w.source,
           (w.created_at >= now() - interval '24 hours') as is_new
    from public.waitlist w
    where not exists (select 1 from auth.users u where lower(u.email) = lower(w.email))
    order by w.created_at desc
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  ) x;

  return jsonb_build_object(
    'waiting', v_waiting,
    'converted', v_converted,
    'new_24h', v_new24,
    'rows', v_rows
  );
end;
$$;

revoke all on function public.waitlist_digest_stats(int) from public, anon, authenticated;
grant execute on function public.waitlist_digest_stats(int) to service_role;

comment on function public.waitlist_digest_stats(int) is
  'Stan waitlisty do dziennego raportu (daily-analytics-digest). Tylko service_role - zwraca adresy e-mail.';
