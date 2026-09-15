-- Zgody lokalu na maile z panelu (makieta „B2B Dashboard / Ustawienia", sekcja Powiadomienia).
--
-- Trzy przelaczniki, trzy kolumny - bez tabeli ustawien, bo to plaskie preferencje jednego
-- wiersza i nic wiecej z nich nie wyniknie. Domyslnie WLACZONE sa dwie rzeczy, ktore lokal
-- realnie chce wiedziec (nowa notatka od goscia, tygodniowe liczby), a marketing (`notify_news`)
-- jest domyslnie WYLACZONY - zgoda na newsletter musi byc czynna, nie odziedziczona.

alter table public.business_profiles
  add column if not exists notify_new_note boolean not null default true,
  add column if not exists notify_weekly_digest boolean not null default true,
  add column if not exists notify_news boolean not null default false;

comment on column public.business_profiles.notify_new_note is
  'Mail do lokalu, gdy gosc zostawi notatke albo zdjecie. Domyslnie wlaczone.';
comment on column public.business_profiles.notify_weekly_digest is
  'Tygodniowe podsumowanie liczb z wizytowki. Domyslnie wlaczone.';
comment on column public.business_profiles.notify_news is
  'Nowosci produktowe spontaway. Domyslnie WYLACZONE - zgoda marketingowa musi byc czynna.';

-- ⚠️ `business_profiles` ma KOLUMNOWE granty SELECT (audyt 2026-09-08), wiec nowa kolumna
-- jest domyslnie NIEWIDOCZNA dla klienta, mimo poprawnego RLS. Panel lokalu czyta wiersz
-- przez `business_profile_for_dashboard` (SECURITY DEFINER, omija granty), ale panel ops
-- i inne odczyty ida wprost - dlatego jawny GRANT.
-- Preferencje mailowe dostaje TYLKO `authenticated`: anon nie ma po co wiedziec, na co
-- lokal sie zgodzil.
grant select (notify_new_note, notify_weekly_digest, notify_news)
  on public.business_profiles to authenticated;

-- Kategorie glowne to informacja publiczna (tak samo jak `main_category`).
grant select (main_categories) on public.business_profiles to anon, authenticated;
