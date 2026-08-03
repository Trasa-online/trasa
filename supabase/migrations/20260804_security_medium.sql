-- ============================================================================
-- AUDYT BEZPIECZENSTWA 2026-08-04 - poprawki MEDIUM (RLS + admin RPC).
-- Bezpieczne, nie wymagaja rebuildu (backend). Wkleic w Supabase SQL Editor.
-- ============================================================================

-- ── M: canonical_pins - dowolny zalogowany mogl UPDATE kazdy pin (zdegenerowane OR) ──
drop policy if exists "Discoverer can update their canonical pins" on public.canonical_pins;
create policy "Discoverer can update their canonical pins" on public.canonical_pins
  for update to authenticated
  using (discovered_by_user_id = auth.uid())
  with check (discovered_by_user_id = auth.uid());
-- (admini nadal moga przez "Admins update canonical pins")

-- ── M: demo_sessions/demo_reactions - anon mial pelny CRUD (kasowanie cudzych) ──
-- Klient: demo_sessions = insert+select; demo_reactions = upsert(insert+update)+select. Zero DELETE.
drop policy if exists "demo_sessions_public" on public.demo_sessions;
create policy "demo_sessions_insert" on public.demo_sessions for insert to anon, authenticated with check (true);
create policy "demo_sessions_select" on public.demo_sessions for select to anon, authenticated using (true);

drop policy if exists "demo_reactions_public" on public.demo_reactions;
create policy "demo_reactions_insert" on public.demo_reactions for insert to anon, authenticated with check (true);
create policy "demo_reactions_update" on public.demo_reactions for update to anon, authenticated using (true) with check (true);
create policy "demo_reactions_select" on public.demo_reactions for select to anon, authenticated using (true);

-- ── M: admin "Koszty Google Places" RPC czytelne dla anon (bramka byla tylko w UI) ──
-- Bramka w samym RPC: dane zwraca tylko admin lub service_role, inaczej pusto.
create or replace function public.google_quota_usage()
returns table(day date, google_calls integer) language sql security definer set search_path to 'public' as $$
  select day, google_calls from public.daily_api_usage
  where day >= (now() at time zone 'utc')::date - 14
    and (has_role(auth.uid(), 'admin'::app_role) or auth.role() = 'service_role')
  order by day desc;
$$;
create or replace function public.textsearch_month_usage()
returns table(month date, textsearch_calls integer) language sql security definer set search_path to 'public' as $$
  select month, textsearch_calls from public.monthly_api_usage
  where has_role(auth.uid(), 'admin'::app_role) or auth.role() = 'service_role'
  order by month desc limit 12;
$$;
revoke execute on function public.google_quota_usage() from anon;
revoke execute on function public.textsearch_month_usage() from anon;
