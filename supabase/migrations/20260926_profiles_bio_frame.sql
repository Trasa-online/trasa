-- Ramka wokol OPISU profilu (prosba Nat 2026-09-25): kwiatki, laka, trawa, zawijasy, serduszka,
-- smuga. Na razie czysto wizualne, bez animacji. Wybor ma byc widoczny dla INNYCH (profil
-- publiczny), wiec siedzi w profiles, obok avatar_frame.
--
-- profiles ma KOLUMNOWE granty SELECT (whitelista pol publicznych). Ta kolumna jest publiczna
-- z zalozenia (jak avatar_frame), wiec dopisanie jej do grantow niczego nie upublicznia.
-- Zapis tylko dla `authenticated` - RLS i tak wpuszcza wylacznie wlasny wiersz.

alter table public.profiles
  add column if not exists bio_frame text null;

alter table public.profiles drop constraint if exists profiles_bio_frame_check;
alter table public.profiles
  add constraint profiles_bio_frame_check
  check (bio_frame is null or bio_frame in ('flowers', 'meadow', 'grass', 'swirls', 'hearts', 'streak'));

grant select (bio_frame) on public.profiles to anon, authenticated;
grant update (bio_frame) on public.profiles to authenticated;
