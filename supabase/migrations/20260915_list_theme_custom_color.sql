-- Kolory kolekcji: szersza paleta + KOLOR WLASNY (prosba Nat 2026-09-15).
--
-- Do tej pory `discovery_collections.theme` przyjmowal 9 identyfikatorow z zamknietej palety
-- marki. Reguła "zamknieta paleta" wzięła się z troski o spójność siatki w eksploracji, ale
-- przy rosnacej liczbie kolekcji dziewiec kolorow zaczelo sie powtarzac - dwie sasiednie
-- kolekcje tego samego autora trafialy na ten sam kafelek i przestawaly byc rozroznialne.
--
-- Teraz CHECK przyjmuje trzy ksztalty:
--   1. NULL          - kolor wyliczany z id (jak dotad; kolekcje sprzed randomizacji),
--   2. id z palety   - 18 nazwanych kolorow (9 dotychczasowych + 9 nowych),
--   3. '#RRGGBB'     - kolor wlasny z pipety, dokladnie jak `profiles.avatar_frame_color`.
--
-- Kolor tekstu (`ink`) NIE jest zapisywany: klient liczy go z jasnosci tla (luminancja),
-- wiec zaden zapis nie moze wyprodukowac nieczytelnego kafelka. Patrz src/lib/listThemes.ts.
--
-- Wielkosc liter w hexie dopuszczona w obie strony - natywny `<input type="color">` na iOS
-- oddaje malymi literami, a szybkie kolory w arkuszu sa wpisane wielkimi.

ALTER TABLE public.discovery_collections DROP CONSTRAINT IF EXISTS discovery_collections_theme_check;

ALTER TABLE public.discovery_collections ADD CONSTRAINT discovery_collections_theme_check CHECK (
  theme IS NULL
  OR theme = ANY (ARRAY[
    -- ciepla baza marki (bez zmian)
    'brick', 'terracotta', 'peach', 'blush', 'pink', 'yellow', 'gold', 'orange', 'brown',
    -- rozszerzenie 2026-09-15
    'cream', 'sand', 'sage', 'moss', 'teal', 'sky', 'denim', 'plum', 'wine'
  ])
  OR theme ~ '^#[0-9A-Fa-f]{6}$'
);
