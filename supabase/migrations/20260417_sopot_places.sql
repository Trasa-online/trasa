-- ─────────────────────────────────────────────────────────────────────────────
-- Sopot places → city = 'Trójmiasto'
-- Coordinates are NULL here; google-places-proxy fills them on first view.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO places (place_name, city, category, primary_category, subcategory, vibe_tags)
SELECT * FROM (VALUES

  -- ── Restauracje ──────────────────────────────────────────────────────────
  ('Bulaj',                  'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Bar Przystań',           'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('White Marlin',           'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('The Blue Pudel',         'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Crudo',                  'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Petit Paris',            'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('M15 Restaurant & Bar',   'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Ferber',                 'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Śliwka w Kompot',        'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Tapas de Rucola',        'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('L''Entre Villes',        'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Fisherman',              'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('No.5',                   'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Jurta',                  'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),
  ('Karczma Irena',          'Trójmiasto', 'restaurant', 'food', 'restaurant', ARRAY['restauracja','jedzenie','lokalne']),

  -- ── Kawiarnie ────────────────────────────────────────────────────────────
  ('Las',                    'Trójmiasto', 'cafe', 'food', 'cafe', ARRAY['kawiarnia','kawa','relaks']),
  ('Dwie Zmiany',            'Trójmiasto', 'cafe', 'food', 'cafe', ARRAY['kawiarnia','kawa','relaks']),
  ('Cafe Ferber',            'Trójmiasto', 'cafe', 'food', 'cafe', ARRAY['kawiarnia','kawa','relaks']),
  ('Costa Coffee Sopot',     'Trójmiasto', 'cafe', 'food', 'cafe', ARRAY['kawiarnia','kawa','relaks']),
  ('Starbucks Monte Cassino','Trójmiasto', 'cafe', 'food', 'cafe', ARRAY['kawiarnia','kawa','relaks']),

  -- ── Cukiernie ────────────────────────────────────────────────────────────
  ('Cukiernia Sowa Sopot',       'Trójmiasto', 'cafe', 'food', 'pastry', ARRAY['cukiernia','słodycze','desery']),
  ('Delicje Sopot',              'Trójmiasto', 'cafe', 'food', 'pastry', ARRAY['cukiernia','słodycze','desery']),
  ('Pijalnia Czekolady Wedel',   'Trójmiasto', 'cafe', 'food', 'pastry', ARRAY['cukiernia','słodycze','desery']),

  -- ── Lodziarnie ───────────────────────────────────────────────────────────
  ('Lody u Jarka',           'Trójmiasto', 'cafe', 'food', 'icecream', ARRAY['lody','desery','lato']),
  ('Ambasada Lodów',         'Trójmiasto', 'cafe', 'food', 'icecream', ARRAY['lody','desery','lato']),
  ('Mroźna Kraina',          'Trójmiasto', 'cafe', 'food', 'icecream', ARRAY['lody','desery','lato']),

  -- ── Kultura ──────────────────────────────────────────────────────────────
  ('Państwowa Galeria Sztuki',   'Trójmiasto', 'gallery',  'culture', 'gallery',   ARRAY['galeria','sztuka','wystawy']),
  ('Dworek Sierakowskich',       'Trójmiasto', 'gallery',  'culture', 'gallery',   ARRAY['galeria','sztuka','wystawy']),
  ('Latarnia Morska Sopot',      'Trójmiasto', 'monument', 'culture', 'monument',  ARRAY['zabytek','historia','architektura']),
  ('Opera Leśna',                'Trójmiasto', 'experience','entertainment','activity', ARRAY['aktywność','rozrywka','zabawa']),
  ('Teatr Atelier',              'Trójmiasto', 'experience','entertainment','activity', ARRAY['aktywność','rozrywka','zabawa']),
  ('Muzeum Sopotu',              'Trójmiasto', 'museum',   'culture', 'museum',    ARRAY['muzeum','historia','kultura']),

  -- ── Rozrywka ─────────────────────────────────────────────────────────────
  ('Aquapark Sopot',         'Trójmiasto', 'experience', 'entertainment', 'activity', ARRAY['aktywność','rozrywka','zabawa']),
  ('Kręgielnia Sopot',       'Trójmiasto', 'experience', 'entertainment', 'activity', ARRAY['aktywność','rozrywka','zabawa']),
  ('Escape Room Sopot',      'Trójmiasto', 'experience', 'entertainment', 'activity', ARRAY['aktywność','rozrywka','zabawa']),
  ('Laser Arena Sopot',      'Trójmiasto', 'experience', 'entertainment', 'activity', ARRAY['aktywność','rozrywka','zabawa']),

  -- ── Zakupy ───────────────────────────────────────────────────────────────
  ('Monte Cassino',          'Trójmiasto', 'shopping', 'shopping', 'mall',    ARRAY['zakupy','centrum','moda']),
  ('Galeria Sopot',          'Trójmiasto', 'shopping', 'shopping', 'mall',    ARRAY['zakupy','centrum','moda']),
  ('Targowisko Sopot',       'Trójmiasto', 'shopping', 'shopping', 'market',  ARRAY['targ','lokalne','świeże']),
  ('Vintage Shop Sopot',     'Trójmiasto', 'shopping', 'shopping', 'vintage', ARRAY['vintage','second-hand','unikat']),

  -- ── Outdoor ──────────────────────────────────────────────────────────────
  ('Molo w Sopocie',         'Trójmiasto', 'viewpoint', 'outdoor', 'viewpoint', ARRAY['widok','panorama','zdjęcia']),
  ('Plaża Sopot',            'Trójmiasto', 'viewpoint', 'outdoor', 'viewpoint', ARRAY['widok','panorama','zdjęcia']),
  ('Park Północny',          'Trójmiasto', 'park',      'outdoor', 'park',      ARRAY['park','natura','spacer']),
  ('Park Południowy',        'Trójmiasto', 'park',      'outdoor', 'park',      ARRAY['park','natura','spacer']),
  ('Klif Sopocki',           'Trójmiasto', 'viewpoint', 'outdoor', 'viewpoint', ARRAY['widok','panorama','zdjęcia'])

) AS t(place_name, city, category, primary_category, subcategory, vibe_tags)
WHERE NOT EXISTS (
  SELECT 1 FROM places p
  WHERE p.place_name = t.place_name AND p.city = 'Trójmiasto'
);
