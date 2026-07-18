-- Kategoria dodatkowa (secondary) - biznes moze nalezec do DWOCH top-level kategorii
-- (np. Orest = Kawiarnia [food] + Zakupy [shopping]). main_category = primary (juz istnieje),
-- secondary_category = opcjonalna druga top-level. Wizytowka pokazuje oba badge.
alter table public.business_profiles
  add column if not exists secondary_category text;
