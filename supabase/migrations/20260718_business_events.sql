-- Sekcja "Wydarzenia" (kolejka nadchodzacych + historia) zastepujaca sciane postow.
-- Lokal planuje kilka eventow na najblizszy okres; wizytowka pokazuje JEDEN pill wg
-- priorytetu (aktywny dzis > staly event_title > najblizszy nadchodzacy). Auto-rotacja
-- dzieje sie przez daty (klient liczy "aktywny" po starts_at/ends_at).
--
-- title_en / title_en_overridden - jak przy pill (auto-tlumaczenie PL->EN + reczne nadpisanie).

create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  place_id text,
  title text not null,
  title_en text,
  title_en_overridden boolean not null default false,
  starts_at date not null,
  ends_at date,
  is_draft boolean not null default false,  -- szkic: widoczny w panelu, NIE na wizytowce
  created_at timestamptz not null default now()
);

-- Gdyby tabela istniala juz bez is_draft (wczesniejsza wersja migracji) - dodaj kolumne.
alter table public.business_events
  add column if not exists is_draft boolean not null default false;

create index if not exists business_events_profile_idx on public.business_events(business_profile_id);
create index if not exists business_events_place_idx on public.business_events(place_id);

alter table public.business_events enable row level security;

-- Publiczny odczyt (wizytowka widziana przez wszystkich).
drop policy if exists "business_events_read" on public.business_events;
create policy "business_events_read" on public.business_events
  for select using (true);

-- CRUD tylko dla wlasciciela lokalu (przez business_profiles.owner_user_id).
drop policy if exists "business_events_insert_own" on public.business_events;
create policy "business_events_insert_own" on public.business_events
  for insert with check (
    exists (select 1 from public.business_profiles bp
            where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  );

drop policy if exists "business_events_update_own" on public.business_events;
create policy "business_events_update_own" on public.business_events
  for update using (
    exists (select 1 from public.business_profiles bp
            where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  );

drop policy if exists "business_events_delete_own" on public.business_events;
create policy "business_events_delete_own" on public.business_events
  for delete using (
    exists (select 1 from public.business_profiles bp
            where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  );
