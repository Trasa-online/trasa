-- Tlo listy miejsc (prosba Nat 2026-09-13, makieta eksploracji): kolorowy kafelek listy na
-- siatce Glownej. Autor wybiera z zamknietej palety marki (src/lib/listThemes.ts) - lista id
-- w CHECK musi sie zgadzac z ta w kodzie. NULL = kolor domyslny wyliczany z id listy.
alter table public.discovery_collections
  add column if not exists theme text null;

alter table public.discovery_collections
  drop constraint if exists discovery_collections_theme_check;
alter table public.discovery_collections
  add constraint discovery_collections_theme_check
  check (theme is null or theme in ('brick','terracotta','peach','blush','pink','yellow','gold','orange','brown'));

comment on column public.discovery_collections.theme is
  'Tlo kafelka listy w eksploracji (paleta marki, src/lib/listThemes.ts). NULL = domyslne z id.';
