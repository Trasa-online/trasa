create table creator_places (
  id                 uuid primary key default gen_random_uuid(),
  creator_handle     text not null,
  city               text not null,
  place_name         text not null,
  category           text,
  description        text,
  instagram_reel_url text,
  google_maps_url    text,
  photo_url          text,
  is_active          boolean default true,
  created_at         timestamptz default now()
);

alter table creator_places enable row level security;

create policy "Public read active" on creator_places
  for select using (is_active = true);

create policy "Authenticated insert" on creator_places
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated update" on creator_places
  for update using (auth.role() = 'authenticated');

create policy "Authenticated delete" on creator_places
  for delete using (auth.role() = 'authenticated');
