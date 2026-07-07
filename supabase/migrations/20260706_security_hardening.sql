-- =====================================================================
-- Security hardening (autoryzowany pentest -> remediacja)
-- =====================================================================

-- ── #1 KRYTYCZNE: bypass moderacji zestawien ─────────────────────────
-- Policy owner_update pozwalala zmienic DOWOLNA kolumne (RLS nie ogranicza
-- kolumn), a INSERT nie ogranicza moderation_status -> user mogl sam sie
-- zatwierdzic (self-approve). Trigger wymusza pending przy insercie i blokuje
-- zmiane moderation_status/hidden_by_admin nie-adminowi.
CREATE OR REPLACE FUNCTION public.guard_discovery_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE is_admin boolean;
BEGIN
  is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
  IF is_admin THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.hidden_by_admin   := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
       OR NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Brak uprawnien do zmiany statusu moderacji';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_discovery_moderation ON public.discovery_collections;
CREATE TRIGGER trg_guard_discovery_moderation
  BEFORE INSERT OR UPDATE ON public.discovery_collections
  FOR EACH ROW EXECUTE FUNCTION public.guard_discovery_moderation();

-- ── #2 WYSOKIE: wyciek pamieci AI (user_memory / user_preference_graph) ──
-- Policy "Service role full access ... FOR ALL USING(true)" bez TO service_role
-- dotyczyla WSZYSTKICH rol -> kazdy zalogowany czytal/zmienial cudze dane.
-- service_role i tak omija RLS, wiec policy jest zbedna -> usuwamy.
DROP POLICY IF EXISTS "Service role full access to user_memory" ON public.user_memory;
DROP POLICY IF EXISTS "Service role full access to user_preference_graph" ON public.user_preference_graph;

-- ── #5 SREDNIE: admin_user_stats widoczny dla wszystkich zalogowanych ──
-- Widok omija RLS tabel bazowych; grant do authenticated ujawnial staty
-- wszystkich userow. Widok nieuzywany w kliencie -> odbieramy dostep.
REVOKE SELECT ON public.admin_user_stats FROM anon, authenticated;

-- ── #7 SREDNIE: business_claims - spoofing user_id ────────────────────
-- "Anyone can submit a business claim" WITH CHECK(true) pozwalal wstawic claim
-- z cudzym user_id. Zostawiamy anonimowe (user_id NULL), ale zalogowany moze
-- podac tylko wlasne uid.
DROP POLICY IF EXISTS "Anyone can submit a business claim" ON public.business_claims;
DROP POLICY IF EXISTS "Users can submit claims" ON public.business_claims;
CREATE POLICY "Submit claim (own uid or anonymous)"
  ON public.business_claims FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ── #6 SREDNIE: proposals czytelne dla wszystkich ────────────────────
-- USING(true) -> kazdy czytal propozycje cudzych sesji. Ograniczamy do czlonkow.
DROP POLICY IF EXISTS "Session members can read proposals" ON public.group_session_place_proposals;
CREATE POLICY "Session members can read proposals"
  ON public.group_session_place_proposals FOR SELECT TO authenticated
  USING (public.is_group_session_member(session_id));

-- ── SREDNIE: group_sessions - enumeracja sesji + join_code ────────────
-- USING(true) pozwalal wyliczyc WSZYSTKIE sesje i ich join_code -> dolaczyc do
-- dowolnej. Ograniczamy odczyt tabeli do czlonkow/tworcy; join-po-kodzie idzie
-- teraz przez SECURITY DEFINER RPC (kod = autoryzacja).
CREATE OR REPLACE FUNCTION public.get_group_session_by_code(p_code text)
RETURNS SETOF public.group_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.group_sessions WHERE join_code = p_code LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_session_by_code(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Auth users can read group sessions" ON public.group_sessions;
CREATE POLICY "Members and creator can read group sessions"
  ON public.group_sessions FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_group_session_member(id));
