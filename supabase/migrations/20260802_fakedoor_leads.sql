-- Fake door (web, branch `web`, trasatravel.com) - leady z testu walidacyjnego.
-- Osobna tabela, NIE ruszamy wspoldzielonej `waitlist` (uzywanej przez apke).
-- Zapisuje: email + ktory przycisk dal sygnal (source) + kontekst trasy.
create table if not exists public.fakedoor_leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  source       text not null default 'unknown', -- 'use_route' | 'create_route'
  route_id     text,
  route_title  text,
  city         text,
  created_at   timestamptz not null default now()
);

alter table public.fakedoor_leads enable row level security;

-- Anon (publiczny web fake door) moze TYLKO wstawiac. Brak polityki SELECT =
-- nikt przez anon/authenticated nie odczyta maili (founderzy czytaja service_role).
drop policy if exists "fakedoor_leads_insert_anon" on public.fakedoor_leads;
create policy "fakedoor_leads_insert_anon" on public.fakedoor_leads
  for insert to anon, authenticated
  with check (true);

create index if not exists fakedoor_leads_created_at_idx on public.fakedoor_leads (created_at desc);
create index if not exists fakedoor_leads_source_idx on public.fakedoor_leads (source);
