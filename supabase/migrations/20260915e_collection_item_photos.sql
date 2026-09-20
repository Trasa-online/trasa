-- ZDJECIA PER-UCZESTNIK W KOLEKCJI (prosba Nat 2026-09-15): "kazdy uczestnik widzi swoje
-- zdjecie z awatarem, zeby bylo wiadomo kto co wrzucil".
--
-- Do tej pory zdjecia miejsca w kolekcji lezaly w tablicy `discovery_items.images[]` - bez
-- autora, wiec przy wspoltworzeniu nie dalo sie powiedziec, kto co dodal, ani pozwolic
-- komus skasowac WLASNE zdjecie bez ruszania cudzych.
--
-- Lustro `pin_photos` z wyjazdow (migracja 20260826), tylko route_id -> collection_id.
-- Zdjecia miejsca w SKALI CALEJ APKI zostaja tam, gdzie byly (`place_photos`) - ta tabela
-- jest o zdjeciach W TEJ KOLEKCJI, tak jak `pin_photos` sa o zdjeciach w tym wyjezdzie.

CREATE TABLE IF NOT EXISTS public.discovery_item_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.discovery_collections(id) ON DELETE CASCADE,
  place_name    text NOT NULL,
  user_id       uuid,
  url           text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dip_collection_idx ON public.discovery_item_photos (collection_id);
CREATE INDEX IF NOT EXISTS dip_place_idx ON public.discovery_item_photos (collection_id, public.place_note_key(place_name));

ALTER TABLE public.discovery_item_photos ENABLE ROW LEVEL SECURITY;

-- Widza wszyscy, ktorzy widza kolekcje (`can_read_collection` z migracji 20260915d):
-- publiczna i zaakceptowana, wlasciciel albo wspoltworca.
DROP POLICY IF EXISTS dip_read ON public.discovery_item_photos;
CREATE POLICY dip_read ON public.discovery_item_photos FOR SELECT
  USING (public.can_read_collection(collection_id, auth.uid()));

-- Dodaje wlasciciel i wspoltworca, zawsze jako SIEBIE.
DROP POLICY IF EXISTS dip_own_insert ON public.discovery_item_photos;
CREATE POLICY dip_own_insert ON public.discovery_item_photos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
    AND (public.is_collection_owner(collection_id, auth.uid()) OR public.is_collection_member(collection_id, auth.uid()))
  );

-- Kasuje autor zdjecia ALBO wlasciciel kolekcji (odpowiada za jej wizerunek i musi moc
-- zdjac cudze zdjecie, ktore do niej nie pasuje).
DROP POLICY IF EXISTS dip_delete ON public.discovery_item_photos;
CREATE POLICY dip_delete ON public.discovery_item_photos FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (user_id = auth.uid() OR public.is_collection_owner(collection_id, auth.uid()))
  );

DROP POLICY IF EXISTS dip_admin_all ON public.discovery_item_photos;
CREATE POLICY dip_admin_all ON public.discovery_item_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role));

-- ── Backfill: istniejace `images[]` to zdjecia WLASCICIELA kolekcji ─────────────────────
INSERT INTO public.discovery_item_photos (collection_id, place_name, user_id, url, created_at)
SELECT di.collection_id, di.place_name, c.user_id, u.url, COALESCE(c.created_at, now())
  FROM public.discovery_items di
  JOIN public.discovery_collections c ON c.id = di.collection_id
  CROSS JOIN LATERAL unnest(COALESCE(di.images, ARRAY[]::text[])) AS u(url)
 WHERE NULLIF(TRIM(COALESCE(u.url, '')), '') IS NOT NULL
   AND c.user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.discovery_item_photos x
      WHERE x.collection_id = di.collection_id AND x.url = u.url
   );

-- ⚠️ `discovery_items.images[]` ZOSTAJE i nadal jest zapisywane przy dodaniu zdjecia przez
-- WLASCICIELA - czytaja je okladki kafelkow i most do `place_photos`. Nowa tabela jest
-- zrodlem prawdy dla WIDOKU kolekcji (kto co wrzucil). Zdjecie wspoltworcy do `images[]`
-- nie trafia: tablica nie ma miejsca na autora, a okladka kolekcji nalezy do wlasciciela.
