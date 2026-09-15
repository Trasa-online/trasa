-- KOSZ: usuniety wyjazd i usunieta kolekcja da sie odzyskac przez 7 dni (prosba Nat 2026-09-15).
--
-- Do tej pory "Usun" bylo NIEODWRACALNE i natychmiastowe: klient robil DELETE na `routes` /
-- `discovery_collections`, a wszystkie dzieci znikaly kaskada (piny, zdjecia pinow, notki,
-- pozycje kolekcji, zapisy innych userow, polubienia). Jedynym zabezpieczeniem byl toast
-- "Cofnij" na kilka sekund (`deferDelete`). Pomylkowe tapniecie po tych kilku sekundach
-- kasowalo wyjazd z calym dziennikiem bez sladu i bez mozliwosci odzyskania.
--
-- Teraz: DELETE zamienia sie w ustawienie `deleted_at`, a prawdziwe kasowanie robi cron po
-- 7 dniach. Dzieci ZOSTAJA nietkniete, wiec odzyskany wyjazd wraca kompletny.
--
-- Widocznosc egzekwuja POLITYKI RLS, nie klient: dopisujemy `deleted_at IS NULL` do KAZDEJ
-- polityki SELECT na obu tabelach. Dzieki temu zaden istniejacy widok (eksploracja, profil,
-- zapisane, wyszukiwarka, powiadomienia, udostepniony link) nie musi nic wiedziec o koszu -
-- wiersz po prostu przestaje istniec dla klienta. To samo zalatwia dzieci: `pins`
-- i `discovery_items` czyta sie wylacznie przez zlaczenie z rodzicem.
--
-- Kosz czyta i obsluguje sie WYLACZNIE przez SECURITY DEFINER RPC (bo wiersz jest niewidoczny
-- dla SELECT-a wlasciciela). Zgodnie z regula z audytu: kazda nowa funkcja SECDEF dostaje
-- REVOKE EXECUTE FROM PUBLIC i jawny GRANT tylko tam, gdzie ma byc wolana.

ALTER TABLE public.routes                 ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.discovery_collections  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Indeksy czesciowe: obsluguja i czyszczenie cronem, i liste kosza wlasciciela. Wiersze zywe
-- (99,9 %) nie wchodza do indeksu, wiec nie kosztuja nic przy zwyklym ruchu.
CREATE INDEX IF NOT EXISTS routes_deleted_at_idx      ON public.routes (deleted_at)                WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS collections_deleted_at_idx ON public.discovery_collections (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── Widocznosc: usuniety wiersz znika ze WSZYSTKICH odczytow klienta ─────────────────────
DROP POLICY IF EXISTS "Owner can read own routes" ON public.routes;
CREATE POLICY "Owner can read own routes" ON public.routes FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Public can read shared routes" ON public.routes;
CREATE POLICY "Public can read shared routes" ON public.routes FOR SELECT
  USING (is_shared = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Group members can read shared routes" ON public.routes;
CREATE POLICY "Group members can read shared routes" ON public.routes FOR SELECT
  USING (
    deleted_at IS NULL AND group_session_id IS NOT NULL
    AND group_session_id IN (SELECT gsm.session_id FROM public.group_session_members gsm WHERE gsm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Group members can see group routes" ON public.routes;
CREATE POLICY "Group members can see group routes" ON public.routes FOR SELECT
  USING (
    deleted_at IS NULL AND group_session_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.group_session_members gsm
                WHERE gsm.session_id = routes.group_session_id AND gsm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS discovery_collections_owner_read ON public.discovery_collections;
CREATE POLICY discovery_collections_owner_read ON public.discovery_collections FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS discovery_collections_public_read ON public.discovery_collections;
CREATE POLICY discovery_collections_public_read ON public.discovery_collections FOR SELECT
  USING (
    is_public = true AND hidden_by_admin = false
    AND moderation_status <> 'rejected'::text AND deleted_at IS NULL
  );

-- Polityka admina (`discovery_collections_admin_all`, FOR ALL) zostaje BEZ warunku: panel ops
-- ma widziec takze to, co lezy w koszu - inaczej zgloszenie tresci, ktora autor wlasnie
-- "usunal", stawaloby sie niemozliwe do rozpatrzenia przed uplywem 7 dni.

-- ── Wrzucenie do kosza ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_content(p_kind text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_hit int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;          -- bez JWT porownanie dalej dalo by NULL
  IF p_kind = 'trip' THEN
    UPDATE public.routes SET deleted_at = now()
     WHERE id = p_id AND user_id = v_uid AND deleted_at IS NULL;
  ELSIF p_kind = 'list' THEN
    UPDATE public.discovery_collections SET deleted_at = now()
     WHERE id = p_id AND user_id = v_uid AND deleted_at IS NULL;
  ELSE
    RETURN false;
  END IF;
  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END; $$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_content(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_content(text, uuid) TO authenticated;

-- ── Odzyskanie ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_from_trash(p_kind text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_hit int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF p_kind = 'trip' THEN
    UPDATE public.routes SET deleted_at = NULL
     WHERE id = p_id AND user_id = v_uid AND deleted_at IS NOT NULL;
  ELSIF p_kind = 'list' THEN
    UPDATE public.discovery_collections SET deleted_at = NULL
     WHERE id = p_id AND user_id = v_uid AND deleted_at IS NOT NULL;
  ELSE
    RETURN false;
  END IF;
  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END; $$;

REVOKE EXECUTE ON FUNCTION public.restore_from_trash(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.restore_from_trash(text, uuid) TO authenticated;

-- ── Skasowanie na zadanie (opróżnienie kosza) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_from_trash(p_kind text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_hit int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  -- Kasujemy TYLKO to, co juz lezy w koszu - ta funkcja nie moze byc skrotem do omijania
  -- kosza na zywym wyjezdzie. Dzieci ida kaskada (FK ON DELETE CASCADE).
  IF p_kind = 'trip' THEN
    DELETE FROM public.routes WHERE id = p_id AND user_id = v_uid AND deleted_at IS NOT NULL;
  ELSIF p_kind = 'list' THEN
    DELETE FROM public.discovery_collections WHERE id = p_id AND user_id = v_uid AND deleted_at IS NOT NULL;
  ELSE
    RETURN false;
  END IF;
  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END; $$;

REVOKE EXECUTE ON FUNCTION public.purge_from_trash(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.purge_from_trash(text, uuid) TO authenticated;

-- ── Zawartosc kosza ──────────────────────────────────────────────────────────────────────
-- Zwraca to, co potrzebne do narysowania wiersza: tytul, okladke, licznik miejsc i termin,
-- po ktorym wpis zniknie na dobre. Wiersze sa niewidoczne dla SELECT-a, wiec czytamy je
-- wylacznie tedy.
CREATE OR REPLACE FUNCTION public.my_trash()
RETURNS TABLE (kind text, id uuid, title text, cover text, items int, deleted_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'trip'::text, r.id, r.title,
         COALESCE(r.list_cover_url, r.cover_url),
         (SELECT count(*)::int FROM public.pins p WHERE p.route_id = r.id),
         r.deleted_at, r.deleted_at + interval '7 days'
    FROM public.routes r
   WHERE r.user_id = auth.uid() AND r.deleted_at IS NOT NULL AND auth.uid() IS NOT NULL
  UNION ALL
  SELECT 'list'::text, c.id, c.title,
         COALESCE(c.list_cover_url, c.cover_url),
         (SELECT count(*)::int FROM public.discovery_items di WHERE di.collection_id = c.id),
         c.deleted_at, c.deleted_at + interval '7 days'
    FROM public.discovery_collections c
   WHERE c.user_id = auth.uid() AND c.deleted_at IS NOT NULL AND auth.uid() IS NOT NULL
   ORDER BY 6 DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.my_trash() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_trash() TO authenticated;

-- ── Czyszczenie po 7 dniach ──────────────────────────────────────────────────────────────
-- Wolane WYLACZNIE przez pg_cron (dziala jako `postgres`), wiec zadna rola klienta nie moze
-- go odpalic - REVOKE bez zadnego GRANT-u.
CREATE OR REPLACE FUNCTION public.purge_expired_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_routes int; v_cols int;
BEGIN
  DELETE FROM public.routes WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_routes = ROW_COUNT;
  DELETE FROM public.discovery_collections WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_cols = ROW_COUNT;
  RETURN v_routes + v_cols;
END; $$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_trash() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('purge-expired-trash') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-trash');
SELECT cron.schedule('purge-expired-trash', '17 3 * * *', $$SELECT public.purge_expired_trash();$$);
