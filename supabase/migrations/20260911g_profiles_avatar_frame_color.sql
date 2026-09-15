-- Kolor ramki awatara (prosba Nat 2026-09-11): user wybiera dowolny kolor; null = domyslny
-- pomarancz marki (wszystkie nakladki domyslnie pomaranczowe). Publiczna jak avatar_frame.
alter table public.profiles
  add column if not exists avatar_frame_color text null;

alter table public.profiles drop constraint if exists profiles_avatar_frame_color_check;
alter table public.profiles
  add constraint profiles_avatar_frame_color_check
  check (avatar_frame_color is null or avatar_frame_color ~ '^#[0-9a-fA-F]{6}$');

grant select (avatar_frame_color), update (avatar_frame_color), insert (avatar_frame_color) on public.profiles to anon, authenticated;
