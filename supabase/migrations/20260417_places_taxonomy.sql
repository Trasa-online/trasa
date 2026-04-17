-- ─────────────────────────────────────────────────────────────────────────────
-- Places taxonomy: primary_category + subcategory + vibe_tags
-- Applies to ALL places in DB; overwrites previous categorisation.
-- Taxonomy based on gdynia_full_final.csv reference.
--
-- primary_category codes: food | culture | entertainment | shopping | outdoor
-- subcategory codes:      restaurant | cafe | bakery | pastry | icecream | bar
--                         | market | museum | theatre | gallery | exhibition
--                         | monument | church | activity | club | nightlife
--                         | mall | vintage | park | viewpoint | trail
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Make sure columns exist
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS primary_category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory       TEXT;

-- ── 1. primary_category ─────────────────────────────────────────────────────
UPDATE places SET primary_category = CASE category
  WHEN 'restaurant' THEN 'food'
  WHEN 'cafe'       THEN 'food'
  WHEN 'bar'        THEN 'food'
  WHEN 'market'     THEN 'food'
  WHEN 'museum'     THEN 'culture'
  WHEN 'gallery'    THEN 'culture'
  WHEN 'monument'   THEN 'culture'
  WHEN 'church'     THEN 'culture'
  WHEN 'park'       THEN 'outdoor'
  WHEN 'viewpoint'  THEN 'outdoor'
  WHEN 'walk'       THEN 'outdoor'
  WHEN 'club'       THEN 'entertainment'
  WHEN 'nightlife'  THEN 'entertainment'
  WHEN 'shopping'   THEN 'shopping'
  WHEN 'experience' THEN 'entertainment'
  ELSE 'other'
END;

-- ── 2. subcategory ──────────────────────────────────────────────────────────
UPDATE places SET subcategory = CASE category
  WHEN 'restaurant' THEN 'restaurant'
  WHEN 'cafe'       THEN 'cafe'
  WHEN 'bar'        THEN 'bar'
  WHEN 'market'     THEN 'market'
  WHEN 'museum'     THEN 'museum'
  WHEN 'gallery'    THEN 'gallery'
  WHEN 'monument'   THEN 'monument'
  WHEN 'church'     THEN 'church'
  WHEN 'park'       THEN 'park'
  WHEN 'viewpoint'  THEN 'viewpoint'
  WHEN 'walk'       THEN 'trail'
  WHEN 'club'       THEN 'club'
  WHEN 'nightlife'  THEN 'nightlife'
  WHEN 'shopping'   THEN 'mall'
  WHEN 'experience' THEN 'activity'
  ELSE category
END;

-- ── 3. Gdynia-specific subcategory overrides (from CSV) ─────────────────────

-- Bakeries
UPDATE places SET primary_category = 'food', subcategory = 'bakery'
WHERE place_name ILIKE 'Piekarnia%' AND city = 'Trójmiasto';

-- Pastry shops
UPDATE places SET primary_category = 'food', subcategory = 'pastry'
WHERE place_name ILIKE 'Cukiernia%' AND city = 'Trójmiasto';
UPDATE places SET primary_category = 'food', subcategory = 'pastry'
WHERE place_name = 'Bajadera' AND city = 'Trójmiasto';

-- Ice cream
UPDATE places SET primary_category = 'food', subcategory = 'icecream'
WHERE place_name ILIKE '%Lody%' AND city = 'Trójmiasto';
UPDATE places SET primary_category = 'food', subcategory = 'icecream'
WHERE place_name = 'Good Lood' AND city = 'Trójmiasto';

-- Theatres
UPDATE places SET primary_category = 'culture', subcategory = 'theatre'
WHERE place_name ILIKE 'Teatr%' AND city = 'Trójmiasto';

-- Exhibitions
UPDATE places SET primary_category = 'culture', subcategory = 'exhibition'
WHERE place_name IN ('InfoBox', 'Konsulat Kultury') AND city = 'Trójmiasto';

-- Activities / fun
UPDATE places SET primary_category = 'entertainment', subcategory = 'activity'
WHERE place_name IN (
  'JumpCity Gdynia', 'Adventure Park Kolibki', 'U7 Gdynia',
  'Zoltar Gdynia', 'Pixel XL Gdynia'
) AND city = 'Trójmiasto';

-- Shopping: malls
UPDATE places SET primary_category = 'shopping', subcategory = 'mall'
WHERE place_name IN ('Riviera Gdynia', 'Centrum Batory') AND city = 'Trójmiasto';

-- Shopping: markets
UPDATE places SET primary_category = 'shopping', subcategory = 'market'
WHERE place_name IN ('Hala Targowa Gdynia', 'Targowisko Chylonia') AND city = 'Trójmiasto';

-- Shopping: vintage
UPDATE places SET primary_category = 'shopping', subcategory = 'vintage'
WHERE place_name = 'Szafa Vintage' AND city = 'Trójmiasto';

-- ── 4. vibe_tags per subcategory (overwrite all) ─────────────────────────────

UPDATE places SET vibe_tags = ARRAY['restauracja', 'jedzenie', 'lokalne']
WHERE subcategory = 'restaurant';

UPDATE places SET vibe_tags = ARRAY['kawiarnia', 'kawa', 'relaks']
WHERE subcategory = 'cafe';

UPDATE places SET vibe_tags = ARRAY['piekarnia', 'świeże', 'śniadanie']
WHERE subcategory = 'bakery';

UPDATE places SET vibe_tags = ARRAY['cukiernia', 'słodycze', 'desery']
WHERE subcategory = 'pastry';

UPDATE places SET vibe_tags = ARRAY['lody', 'desery', 'lato']
WHERE subcategory = 'icecream';

UPDATE places SET vibe_tags = ARRAY['bar', 'piwo', 'koktajle']
WHERE subcategory = 'bar';

UPDATE places SET vibe_tags = ARRAY['targ', 'lokalne', 'świeże']
WHERE subcategory = 'market';

UPDATE places SET vibe_tags = ARRAY['muzeum', 'historia', 'kultura']
WHERE subcategory = 'museum';

UPDATE places SET vibe_tags = ARRAY['teatr', 'spektakl', 'kultura']
WHERE subcategory = 'theatre';

UPDATE places SET vibe_tags = ARRAY['galeria', 'sztuka', 'wystawy']
WHERE subcategory = 'gallery';

UPDATE places SET vibe_tags = ARRAY['wystawa', 'kultura', 'ekspozycja']
WHERE subcategory = 'exhibition';

UPDATE places SET vibe_tags = ARRAY['zabytek', 'historia', 'architektura']
WHERE subcategory = 'monument';

UPDATE places SET vibe_tags = ARRAY['kościół', 'architektura', 'historia']
WHERE subcategory = 'church';

UPDATE places SET vibe_tags = ARRAY['aktywność', 'rozrywka', 'zabawa']
WHERE subcategory = 'activity';

UPDATE places SET vibe_tags = ARRAY['klub', 'muzyka', 'nocne życie']
WHERE subcategory = 'club';

UPDATE places SET vibe_tags = ARRAY['nocne życie', 'muzyka', 'taniec']
WHERE subcategory = 'nightlife';

UPDATE places SET vibe_tags = ARRAY['zakupy', 'centrum', 'moda']
WHERE subcategory = 'mall';

UPDATE places SET vibe_tags = ARRAY['vintage', 'second-hand', 'unikat']
WHERE subcategory = 'vintage';

UPDATE places SET vibe_tags = ARRAY['park', 'natura', 'spacer']
WHERE subcategory = 'park';

UPDATE places SET vibe_tags = ARRAY['widok', 'panorama', 'zdjęcia']
WHERE subcategory = 'viewpoint';

UPDATE places SET vibe_tags = ARRAY['spacer', 'natura', 'trasa']
WHERE subcategory = 'trail';
