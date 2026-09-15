-- Miasto per POZYCJA listy (wczesniej miasto bylo tylko na kolekcji).
-- Powod: lista "Ogolne" jest globalna (city = NULL), wiec zapisane w niej miejsca gubily
-- informacje o miescie - kafelki na profilu pokazywaly sama nazwe. Dodatkowo nowy przeplyw
-- "Dodaj nowe miejsce" (kraj + miasto + nazwa) musi to miasto gdzies zapisac.
ALTER TABLE public.discovery_items ADD COLUMN IF NOT EXISTS city text;

-- Backfill: pozycje z list per-miasto dziedzicza miasto swojej kolekcji.
UPDATE public.discovery_items i
SET city = c.city
FROM public.discovery_collections c
WHERE i.collection_id = c.id AND i.city IS NULL AND c.city IS NOT NULL;
