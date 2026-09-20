-- Dwie ROWNORZEDNE kategorie glowne zamiast main_category + secondary_category.
-- Decyzja Nat 2026-09-14: lokal wybiera 1-2 kategorie glowne (bez hierarchii, bez
-- "dodatkowej") i 1-3 podkategorie LACZNIE, po minimum jednej do kazdej wybranej glownej.
--
-- ⛔ Limit 2 pilnuje PANEL, nie baza. Lokale z trzema tozsamosciami (kawiarnia + sklep
-- + galeria) Nat dodaje recznie jako wyjatki - CHECK na tabeli zablokowalby te wpisy.
-- Baza pilnuje tylko tego, co niepodwazalne: tablica nie jest pusta dla aktywnych wizytowek.

alter table public.business_profiles
  add column if not exists main_categories text[] not null default '{}';

-- Backfill: main_category pierwsze, secondary_category drugie, bez nulli i duplikatow.
update public.business_profiles
set main_categories = array_remove(
      array[main_category, nullif(secondary_category, main_category)],
      null
    )
where coalesce(array_length(main_categories, 1), 0) = 0
  and main_category is not null;

-- Filtrowanie po kategoriach idzie przez operator zawierania (&&), wiec GIN.
create index if not exists business_profiles_main_categories_idx
  on public.business_profiles using gin (main_categories);

comment on column public.business_profiles.main_categories is
  '1-2 rownorzedne kategorie glowne (id z MAIN_CATEGORIES). Limit walidowany w panelu, nie w bazie.';
comment on column public.business_profiles.main_category is
  'DEPRECATED 2026-09-15 - zastapione przez main_categories[]. Zostaje do czasu przepiecia wszystkich odczytow.';
comment on column public.business_profiles.secondary_category is
  'DEPRECATED 2026-09-15 - wchlonieta przez main_categories[]. Nie zapisywac.';
