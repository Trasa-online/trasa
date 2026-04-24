-- Discovery collections: user-created "Top N" lists shown on the home feed
CREATE TABLE discovery_collections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT        NOT NULL DEFAULT 'Anonim',
  author_avatar TEXT,
  title       TEXT        NOT NULL,
  city        TEXT,
  description TEXT,
  is_public   BOOLEAN     NOT NULL DEFAULT true
);

-- Individual items within a collection
CREATE TABLE discovery_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID        NOT NULL REFERENCES discovery_collections(id) ON DELETE CASCADE,
  order_index   SMALLINT    NOT NULL DEFAULT 0,
  place_name    TEXT        NOT NULL,
  short_desc    TEXT,
  photo_url     TEXT
);

ALTER TABLE discovery_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discovery_collections_public_read" ON discovery_collections
  FOR SELECT USING (is_public = true);

CREATE POLICY "discovery_items_public_read" ON discovery_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM discovery_collections c
      WHERE c.id = collection_id AND c.is_public = true
    )
  );

CREATE POLICY "discovery_collections_auth_insert" ON discovery_collections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "discovery_items_auth_insert" ON discovery_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM discovery_collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

-- ── Seed: example collections ──────────────────────────────────────────────────

INSERT INTO discovery_collections (id, author_name, title, city, description) VALUES
  ('dc000001-0000-0000-0000-000000000001', 'Zespół Trasy', 'Top 5 kawiarni w Gdańsku',    'Gdańsk',  'Najlepsze miejsca na kawę w trójmieście — sprawdzone i polecane przez lokalnych.'),
  ('dc000001-0000-0000-0000-000000000002', 'Zespół Trasy', 'Top 5 restauracji w Krakowie', 'Kraków',  'Autentyczna kuchnia polska i odkrycia kulinarnej stolicy kraju.'),
  ('dc000001-0000-0000-0000-000000000003', 'Zespół Trasy', 'Top 5 widoków w Warszawie',   'Warszawa', 'Miejsca, z których Warszawa wygląda jak na pocztówce.');

INSERT INTO discovery_items (collection_id, order_index, place_name, short_desc, photo_url) VALUES
  -- Gdańsk kawiarnie
  ('dc000001-0000-0000-0000-000000000001', 0, 'Café Ferber',      'Idealne espresso i domowe wypieki.',       'https://picsum.photos/seed/gdansk-cafe-1/800/600'),
  ('dc000001-0000-0000-0000-000000000001', 1, 'Drukarnia Cafe',   'Historia i kawa w sercu Starego Miasta.',  'https://picsum.photos/seed/gdansk-cafe-2/800/600'),
  ('dc000001-0000-0000-0000-000000000001', 2, 'Kamienica Cafe',   'Klimatyczne wnętrze, pyszna granola.',     'https://picsum.photos/seed/gdansk-cafe-3/800/600'),
  ('dc000001-0000-0000-0000-000000000001', 3, 'Kawa & Herbata',   'Herbaty świata i autorskie kawy.',         'https://picsum.photos/seed/gdansk-cafe-4/800/600'),
  ('dc000001-0000-0000-0000-000000000001', 4, 'Oaza Cafe',        'Spokojny ogródek, śniadania do 14:00.',    'https://picsum.photos/seed/gdansk-cafe-5/800/600'),
  -- Kraków restauracje
  ('dc000001-0000-0000-0000-000000000002', 0, 'Miodova',          'Najlepsza żurek w całym Krakowie.',        'https://picsum.photos/seed/krakow-resto-1/800/600'),
  ('dc000001-0000-0000-0000-000000000002', 1, 'Pod Aniołami',     'Średniowieczne piwnice, grillowane mięsa.','https://picsum.photos/seed/krakow-resto-2/800/600'),
  ('dc000001-0000-0000-0000-000000000002', 2, 'Szara Gęś',        'Fine dining przy Rynku Głównym.',          'https://picsum.photos/seed/krakow-resto-3/800/600'),
  ('dc000001-0000-0000-0000-000000000002', 3, 'Wentzl',           'Tradycja od 1792 roku, legendarne pierogi.','https://picsum.photos/seed/krakow-resto-4/800/600'),
  ('dc000001-0000-0000-0000-000000000002', 4, 'Hawełka',          'Krakowska klasyka, barszcz z uszkami.',    'https://picsum.photos/seed/krakow-resto-5/800/600'),
  -- Warszawa widoki
  ('dc000001-0000-0000-0000-000000000003', 0, 'Pałac Kultury',    'Taras widokowy na 30. piętrze.',           'https://picsum.photos/seed/warsaw-view-1/800/600'),
  ('dc000001-0000-0000-0000-000000000003', 1, 'Złota Tarrace',    'Dachy miasta o zachodzie słońca.',         'https://picsum.photos/seed/warsaw-view-2/800/600'),
  ('dc000001-0000-0000-0000-000000000003', 2, 'Most Świętokrzyski','Panorama Wisły i Starego Miasta.',        'https://picsum.photos/seed/warsaw-view-3/800/600'),
  ('dc000001-0000-0000-0000-000000000003', 3, 'Skarpa Warszawska','Spacer wzdłuż urwiska nad Wisłą.',         'https://picsum.photos/seed/warsaw-view-4/800/600'),
  ('dc000001-0000-0000-0000-000000000003', 4, 'Kopiec Czerniakowski','Zielony punkt widokowy na południu.',   'https://picsum.photos/seed/warsaw-view-5/800/600');
