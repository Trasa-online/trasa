-- Zgodnosc z App Store Guideline 1.2 (tresci od uzytkownikow): zgloszenia tresci,
-- blokowanie userow, akceptacja regulaminu. Zdjecia miejsc maja juz place_flags.

-- 1. ZGLOSZENIA TRESCI (trasa / lista / user). Miejsca zostaja w place_flags.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('route', 'collection', 'user')),
  target_id uuid not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
-- Anty-spam: jedno otwarte zgloszenie na (tresc, zglaszajacy).
create unique index if not exists content_reports_unique_open
  on public.content_reports (target_type, target_id, reporter_id) where status = 'open';
create index if not exists content_reports_open_idx on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "Users insert own reports" on public.content_reports;
create policy "Users insert own reports" on public.content_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "Users read own reports" on public.content_reports;
create policy "Users read own reports" on public.content_reports
  for select to authenticated using (auth.uid() = reporter_id);

drop policy if exists "Admins manage reports" on public.content_reports;
create policy "Admins manage reports" on public.content_reports
  for all to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- 2. BLOKOWANIE USEROW - blokujacy nie widzi tresci zablokowanego (filtr po stronie klienta).
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);
alter table public.blocked_users enable row level security;

drop policy if exists "Users manage own blocks" on public.blocked_users;
create policy "Users manage own blocks" on public.blocked_users
  for all to authenticated using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- 3. AKCEPTACJA REGULAMINU (EULA) - wymog przy tresciach od uzytkownikow.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
