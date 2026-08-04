-- ============================================================================
-- Onboarding: odpowiedzi ankietowe (2026-08-04).
-- Zbierane w kreatorze onboardingu po pierwszym logowaniu:
--   1) skad user zna spontaway (referral_source + ew. referral_other),
--   2) w jakim celu chce korzystac (goals[] + ew. goals_other).
-- Jedna wiersz per user. RLS: user zarzadza wylacznie wlasnym wierszem.
-- ============================================================================

create table if not exists public.onboarding_responses (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  referral_source text,
  referral_other  text,
  goals           text[],
  goals_other     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.onboarding_responses enable row level security;

-- Wlasny wiersz: insert/select/update tylko dla auth.uid() = user_id.
drop policy if exists "onboarding_own_insert" on public.onboarding_responses;
create policy "onboarding_own_insert" on public.onboarding_responses
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "onboarding_own_select" on public.onboarding_responses;
create policy "onboarding_own_select" on public.onboarding_responses
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "onboarding_own_update" on public.onboarding_responses;
create policy "onboarding_own_update" on public.onboarding_responses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
