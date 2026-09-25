-- Ramki opisu (2026-09-26, prosba Nat): zostaja TYLKO smuga, laka i kwiatki; trawa, zawijasy
-- i serduszka zdjete. Doszedl KOLOR ramki (#RRGGBB, NULL = kolory marki, jak dotad).
-- Kolumna publiczna z zalozenia (jak avatar_frame_color) - widac ja na profilu publicznym.

update public.profiles set bio_frame = null where bio_frame in ('grass', 'swirls', 'hearts');

alter table public.profiles drop constraint if exists profiles_bio_frame_check;
alter table public.profiles
  add constraint profiles_bio_frame_check
  check (bio_frame is null or bio_frame in ('flowers', 'meadow', 'streak'));

alter table public.profiles add column if not exists bio_frame_color text null;
alter table public.profiles drop constraint if exists profiles_bio_frame_color_check;
alter table public.profiles
  add constraint profiles_bio_frame_color_check
  check (bio_frame_color is null or bio_frame_color ~ '^#[0-9A-Fa-f]{6}$');

grant select (bio_frame_color) on public.profiles to anon, authenticated;
grant update (bio_frame_color) on public.profiles to authenticated;
