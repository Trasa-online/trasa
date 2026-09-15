-- #3e + #6: zdjecia userow dodawane do miejsca (z galerii wizytowki) + lajki zdjec w galerii.
-- Jeden spojny schemat (projekt raz - zeby lajki wisialy na stabilnym kluczu, nie na URL-u
-- ktory bywa rozny dla Google-proxy vs Storage).

-- ── #3e: zdjecia userow przypisane do MIEJSCA (nie do pinu/trasy) ──────────────
-- place_key = stabilna tozsamosc miejsca: google_place_id LUB 'nazwa|miasto' (lower).
create table if not exists public.place_photos (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  place_key   text        not null,
  place_name  text        not null,
  city        text,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  photo_url   text        not null
);
create index if not exists idx_place_photos_key on public.place_photos(place_key);
create index if not exists idx_place_photos_user on public.place_photos(user_id);

alter table public.place_photos enable row level security;
-- Public content (galeria miejsca widoczna dla wszystkich).
create policy "place_photos_public_read"  on public.place_photos for select using (true);
create policy "place_photos_owner_insert" on public.place_photos for insert to authenticated with check (auth.uid() = user_id);
create policy "place_photos_owner_delete" on public.place_photos for delete to authenticated using (auth.uid() = user_id);

-- ── #6: lajki zdjec w galerii (dowolne zrodlo: Storage/B2B/user) ───────────────
-- photo_ref = stabilny klucz zdjecia. Dla zdjec userow (#3e) = 'pp:{place_photos.id}';
-- dla zdjec z cache Storage / B2B = URL (stabilny). Unikalny lajk per (ref, user).
create table if not exists public.photo_likes (
  photo_ref  text        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_ref, user_id)
);
create index if not exists idx_photo_likes_ref on public.photo_likes(photo_ref);

alter table public.photo_likes enable row level security;
create policy "photo_likes_public_read"  on public.photo_likes for select using (true);
create policy "photo_likes_owner_insert" on public.photo_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "photo_likes_owner_delete" on public.photo_likes for delete to authenticated using (auth.uid() = user_id);

-- Zliczanie lajkow dla zestawu zdjec jednym zapytaniem (galeria wielu zdjec).
create or replace function public.photo_like_counts(p_refs text[])
returns table(photo_ref text, cnt bigint)
language sql stable
as $$
  select photo_ref, count(*)::bigint
  from public.photo_likes
  where photo_ref = any(p_refs)
  group by photo_ref;
$$;
grant execute on function public.photo_like_counts(text[]) to anon, authenticated;

-- ── Storage: pozwol zalogowanym wrzucac do bucketa place-photos w folderze = ich uid ──
-- (public read juz istnieje). Sciezka: {uid}/{plik} -> owner-only insert/delete.
create policy "place_photos_bucket_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "place_photos_bucket_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);
