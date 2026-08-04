-- ============================================================================
-- Faza 3 tras grupowych (2026-08-04): WSPOLNE zdjecia wyjazdu.
-- W modelu host-owned (jedna trasa) uczestnicy NIE maja kopii, wiec nie moga dodac
-- zdjec do routes.review_photos (owner-only RLS). Ta tabela trzyma zdjecia na poziomie
-- SESJI - kazdy czlonek dodaje wlasne, wszyscy widza wszystkie. To jedyne zdjecia
-- pokazywane potem w eksploracji (wg decyzji nat).
-- ============================================================================

create table if not exists public.group_trip_photos (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  route_id   uuid references public.routes(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);

alter table public.group_trip_photos enable row level security;

-- SELECT: czlonek sesji widzi wszystkie zdjecia; dodatkowo zdjecia sesji, ktorej trasa jest
-- PUBLICZNA (is_shared) sa widoczne dla wszystkich - zeby pokazac je w eksploracji (grupowe
-- trasy sa publiczne domyslnie). Prywatna sesja bez publicznej trasy = tylko czlonkowie.
drop policy if exists "gtp_select_member" on public.group_trip_photos;
drop policy if exists "gtp_select" on public.group_trip_photos;
create policy "gtp_select" on public.group_trip_photos
  for select to authenticated
  using (
    public.is_group_session_member(session_id)
    or exists (
      select 1 from public.routes r
      where r.group_session_id = group_trip_photos.session_id and r.is_shared = true
    )
  );

-- Czlonek dodaje WLASNE zdjecia (musi byc czlonkiem sesji).
drop policy if exists "gtp_insert_own" on public.group_trip_photos;
create policy "gtp_insert_own" on public.group_trip_photos
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_group_session_member(session_id));

-- Wlasne zdjecie usuwa autor.
drop policy if exists "gtp_delete_own" on public.group_trip_photos;
create policy "gtp_delete_own" on public.group_trip_photos
  for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_gtp_session on public.group_trip_photos(session_id);
