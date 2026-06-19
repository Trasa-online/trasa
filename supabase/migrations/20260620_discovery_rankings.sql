-- Rankingi miejsc tworzone przez userow (rozszerzenie discovery_collections).
-- Itemy linkowane do realnych places (place_id) -> tap otwiera pelna wizytowke.
-- Miejsca spoza bazy (custom): place_id=null + dane z Google (rating, google_place_id) ->
-- pokazywane jako nieklikalna karta (okladka+nazwa+adres+gwiazdki), BEZ tworzenia places.

-- 1. Itemy: link do places + dane custom miejsca.
ALTER TABLE discovery_items
  ADD COLUMN IF NOT EXISTS place_id        UUID REFERENCES public.places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS rating          NUMERIC;
CREATE INDEX IF NOT EXISTS idx_discovery_items_place_id ON discovery_items(place_id);

-- 2. Kolekcje: rozroznienie rankingow + moderacja + sortowanie po swiezosci.
ALTER TABLE discovery_collections
  ADD COLUMN IF NOT EXISTS kind            TEXT NOT NULL DEFAULT 'ranking' CHECK (kind IN ('ranking','collection')),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_discovery_collections_city_public
  ON discovery_collections(city, is_public) WHERE is_public = true;

-- 3. Public read: ukryj zmoderowane (collections + items).
DROP POLICY IF EXISTS "discovery_collections_public_read" ON discovery_collections;
CREATE POLICY "discovery_collections_public_read" ON discovery_collections
  FOR SELECT USING (is_public = true AND hidden_by_admin = false);

DROP POLICY IF EXISTS "discovery_items_public_read" ON discovery_items;
CREATE POLICY "discovery_items_public_read" ON discovery_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM discovery_collections c
            WHERE c.id = collection_id AND c.is_public = true AND c.hidden_by_admin = false)
  );

-- 4. Owner UPDATE/DELETE wlasnych collections + items (gap - dzis brak, user nie moze edytowac/usuwac).
CREATE POLICY "discovery_collections_owner_update" ON discovery_collections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "discovery_collections_owner_delete" ON discovery_collections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "discovery_items_owner_update" ON discovery_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM discovery_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM discovery_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );
CREATE POLICY "discovery_items_owner_delete" ON discovery_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM discovery_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );

-- 5. Admin: pelny dostep (moderacja hide/unhide, podglad ukrytych).
CREATE POLICY "discovery_collections_admin_all" ON discovery_collections
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
