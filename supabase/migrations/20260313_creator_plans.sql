create table creator_plans (
  id             uuid primary key default gen_random_uuid(),
  creator_handle text not null,
  city           text not null,
  title          text not null,
  video_url      text,
  thumbnail_url  text,
  is_active      boolean default true,
  created_at     timestamptz default now()
);

alter table creator_plans enable row level security;

create policy "Public read active" on creator_plans
  for select using (is_active = true);

create policy "Authenticated write" on creator_plans
  for all using (auth.role() = 'authenticated');

alter table creator_places
  add column plan_id uuid references creator_plans(id) on delete cascade;
