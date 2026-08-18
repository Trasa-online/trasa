-- #3: dedup zdjec galerii po TRESCI. Ta sama scena wgrana dwoma kanalami (review_photos vs
-- group_trip_photos) = rozne pliki/URL, ale identyczna zawartosc -> ten sam sha256. Galeria
-- deduplikuje po hashu (scala w 1 kafelek), NIGDY nie ukrywa unikalnego zdjecia.
create table if not exists public.photo_hashes (
  url    text primary key,
  sha256 text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_photo_hashes_sha on public.photo_hashes(sha256);
alter table public.photo_hashes enable row level security;
create policy "photo_hashes_public_read" on public.photo_hashes for select using (true);
create policy "photo_hashes_auth_upsert" on public.photo_hashes for insert to authenticated with check (true);
