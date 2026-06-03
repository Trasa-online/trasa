-- Dodaje pole na zdjecia menu/cennika dla wizytowki biznesowej.
-- Pojedyncze pole TEXT[] - label w UI zalezny od main_category:
--   food            -> "Menu"
--   culture/attractions -> "Cennik"
--   nature          -> sekcja sie nie pokazuje
-- Limit aplikacyjny: 6 zdjec (firmy z wieksza iloscia menu zglaszaja sie po zwiekszenie).

alter table public.business_profiles
  add column if not exists menu_image_urls text[] not null default '{}';

comment on column public.business_profiles.menu_image_urls is
  'Zdjecia menu (dla food) lub cennika (dla culture/attractions). Max 6 elementow - limit aplikacyjny po stronie klienta.';
