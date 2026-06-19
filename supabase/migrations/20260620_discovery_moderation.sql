-- Moderacja UGC: zestawienia od anonimowych userow czekaja na akceptacje admina ZANIM
-- trafia na publiczny feed. Konta z emailem publikuja od razu. Zdejmuje ryzyko App Store
-- Guideline 1.2 (UGC bez moderacji) + tresci obrazliwe/podszywanie sie pod lokale.

ALTER TABLE discovery_collections
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected'));

-- Istniejace zestawienia = approved (nie chowaj juz opublikowanych).
UPDATE discovery_collections SET moderation_status = 'approved' WHERE moderation_status = 'pending';

-- Public read: tylko zaakceptowane (+ dotychczasowe: is_public AND NOT hidden_by_admin).
DROP POLICY IF EXISTS "discovery_collections_public_read" ON discovery_collections;
CREATE POLICY "discovery_collections_public_read" ON discovery_collections
  FOR SELECT USING (is_public = true AND hidden_by_admin = false AND moderation_status = 'approved');

DROP POLICY IF EXISTS "discovery_items_public_read" ON discovery_items;
CREATE POLICY "discovery_items_public_read" ON discovery_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM discovery_collections c
            WHERE c.id = collection_id AND c.is_public = true
              AND c.hidden_by_admin = false AND c.moderation_status = 'approved')
  );

-- Owner widzi wlasne (takze pending/rejected) - zeby autor wiedzial, ze czeka na akceptacje.
DROP POLICY IF EXISTS "discovery_collections_owner_read" ON discovery_collections;
CREATE POLICY "discovery_collections_owner_read" ON discovery_collections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
