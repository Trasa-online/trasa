-- ── 1. Move Gdańsk places under Trójmiasto ──────────────────────────────────
UPDATE places SET city = 'Trójmiasto' WHERE city = 'Gdańsk';

-- ── 2. Add categorization columns ────────────────────────────────────────────
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS primary_category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory       TEXT;

-- ── 3. primary_category — high-level groups ───────────────────────────────────
UPDATE places SET primary_category = CASE category
  WHEN 'restaurant' THEN 'Gastronomia'
  WHEN 'cafe'       THEN 'Gastronomia'
  WHEN 'bar'        THEN 'Gastronomia'
  WHEN 'market'     THEN 'Gastronomia'
  WHEN 'museum'     THEN 'Kultura'
  WHEN 'gallery'    THEN 'Kultura'
  WHEN 'monument'   THEN 'Kultura'
  WHEN 'church'     THEN 'Kultura'
  WHEN 'park'       THEN 'Natura'
  WHEN 'viewpoint'  THEN 'Natura'
  WHEN 'walk'       THEN 'Natura'
  WHEN 'club'       THEN 'Rozrywka nocna'
  WHEN 'nightlife'  THEN 'Rozrywka nocna'
  WHEN 'shopping'   THEN 'Zakupy'
  WHEN 'experience' THEN 'Rozrywka'
  ELSE 'Inne'
END
WHERE primary_category IS NULL;

-- ── 4. subcategory — specific Polish label ────────────────────────────────────
UPDATE places SET subcategory = CASE category
  WHEN 'restaurant' THEN 'Restauracja'
  WHEN 'cafe'       THEN 'Kawiarnia'
  WHEN 'bar'        THEN 'Bar'
  WHEN 'market'     THEN 'Targ / Hala'
  WHEN 'club'       THEN 'Klub nocny'
  WHEN 'nightlife'  THEN 'Rozrywka nocna'
  WHEN 'museum'     THEN 'Muzeum'
  WHEN 'gallery'    THEN 'Galeria sztuki'
  WHEN 'monument'   THEN 'Zabytek / Pomnik'
  WHEN 'church'     THEN 'Kościół'
  WHEN 'park'       THEN 'Park / Ogród'
  WHEN 'viewpoint'  THEN 'Punkt widokowy'
  WHEN 'walk'       THEN 'Trasa spacerowa'
  WHEN 'shopping'   THEN 'Centrum handlowe'
  WHEN 'experience' THEN 'Atrakcja'
  ELSE category
END
WHERE subcategory IS NULL;

-- ── 5. Fill missing vibe_tags with category-based defaults ────────────────────
UPDATE places SET vibe_tags = ARRAY['restauracja', 'jedzenie', 'lokalne']
WHERE category = 'restaurant' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['kawiarnia', 'kawa', 'relaks', 'śniadanie']
WHERE category = 'cafe' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['bar', 'piwo', 'wieczór', 'koktajle']
WHERE category = 'bar' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['muzeum', 'kultura', 'historia', 'wystawy']
WHERE category = 'museum' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['sztuka', 'galeria', 'kultura', 'wystawy']
WHERE category = 'gallery' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['zabytek', 'historia', 'architektura']
WHERE category = 'monument' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['park', 'natura', 'spacer', 'relaks']
WHERE category = 'park' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['widok', 'panorama', 'fotografia', 'natura']
WHERE category = 'viewpoint' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['zakupy', 'moda', 'design']
WHERE category = 'shopping' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['atrakcja', 'rozrywka', 'aktywność']
WHERE category = 'experience' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['targ', 'świeże', 'lokalne', 'rynek']
WHERE category = 'market' AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);

UPDATE places SET vibe_tags = ARRAY['klub', 'muzyka', 'nocne życie', 'taniec']
WHERE category IN ('club', 'nightlife') AND (vibe_tags IS NULL OR array_length(vibe_tags, 1) = 0);
