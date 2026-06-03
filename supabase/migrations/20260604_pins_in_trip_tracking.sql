-- In-trip tracking: pola na pinach + storage bucket dla user-generated photos z trasy.
-- Cel: po stworzeniu trasy user trafia na widok 'w trakcie podrozy' gdzie oznacza
-- 'bylem tutaj' checkboxem (visited_at) i wgrywa zdjecia z miejsca (user_photo_urls).

alter table public.pins
  add column if not exists visited_at timestamptz null,
  add column if not exists user_photo_urls text[] not null default '{}';

comment on column public.pins.visited_at is
  'Timestamp gdy user oznaczyl checkbox bylem w tym miejscu. NULL = jeszcze nie odwiedzone.';
comment on column public.pins.user_photo_urls is
  'Zdjecia uzytkownika wgrane in-trip dla tego pinu. Storage bucket trip-photos, max 5 sztuk per pin (limit aplikacyjny).';

-- Storage bucket dla user-generated photos z trasy (publiczny - readable przez URL).
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- RLS na storage.objects: user moze upload/update/delete tylko w swoim folderze
-- (struktura: trip-photos/{user_id}/{route_id}/{pin_id}/{idx}.jpg)
drop policy if exists "trip_photos_user_upload" on storage.objects;
create policy "trip_photos_user_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "trip_photos_user_update" on storage.objects;
create policy "trip_photos_user_update" on storage.objects for update to authenticated
  using (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "trip_photos_user_delete" on storage.objects;
create policy "trip_photos_user_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "trip_photos_public_read" on storage.objects;
create policy "trip_photos_public_read" on storage.objects for select to public
  using (bucket_id = 'trip-photos');
