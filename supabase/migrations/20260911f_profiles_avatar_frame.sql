-- Ramka / nakladka na awatar (prosba Nat 2026-09-11): gwiazdki, serduszka, chmurki krazace
-- wokol zdjecia. Wybor usera musi byc widoczny dla INNYCH (naglowek wyjazdu, listy, profil
-- publiczny), wiec siedzi w profiles, nie w localStorage.
--
-- profiles ma KOLUMNOWE granty SELECT (whitelista pol publicznych). Ta kolumna jest publiczna
-- Z ZALOZENIA - jak avatar_url, ktory jest na whitelistcie - wiec dopisanie jej do grantow
-- niczego nie upublicznia. To NIE jest precedens dla pol prywatnych (patrz referral_stats()).

alter table public.profiles
  add column if not exists avatar_frame text null;

alter table public.profiles drop constraint if exists profiles_avatar_frame_check;
alter table public.profiles
  add constraint profiles_avatar_frame_check
  check (avatar_frame is null or avatar_frame in ('stars', 'hearts', 'clouds'));

grant select (avatar_frame), update (avatar_frame), insert (avatar_frame) on public.profiles to anon, authenticated;
