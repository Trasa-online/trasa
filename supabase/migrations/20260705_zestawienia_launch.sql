-- Zestawienia (discovery_collections) launch: motyw + statystyki + kolumny udostepniania tras.
-- Feature odblokowany w kliencie (Explore/CreateRanking/DiscoveryFeed).

-- ── Motyw + statystyki zestawien ─────────────────────────────────────────────
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS category        text,
  ADD COLUMN IF NOT EXISTS views_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_adds_count integer NOT NULL DEFAULT 0;

-- Licznik wyswietlen (dedup per-widz po stronie klienta w localStorage). Tylko
-- publiczne + zaakceptowane, zeby nie windowac prywatnych/pending. SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.increment_collection_views(p_collection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discovery_collections
  SET views_count = views_count + 1
  WHERE id = p_collection_id
    AND is_public = true
    AND moderation_status = 'approved';
END;
$$;

-- Licznik polubien miejsc z zestawienia (user klika "Dodaj do polubionych").
CREATE OR REPLACE FUNCTION public.increment_collection_saves(p_collection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discovery_collections
  SET saves_count = saves_count + 1
  WHERE id = p_collection_id
    AND is_public = true
    AND moderation_status = 'approved';
END;
$$;

-- Licznik dodan zestawienia do wlasnego planu ("Uzyj tej trasy").
CREATE OR REPLACE FUNCTION public.increment_collection_plan_adds(p_collection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discovery_collections
  SET plan_adds_count = plan_adds_count + 1
  WHERE id = p_collection_id
    AND is_public = true
    AND moderation_status = 'approved';
END;
$$;

-- Zestawienia widoczne tez dla niezalogowanych (web) -> grant anon + authenticated.
GRANT EXECUTE ON FUNCTION public.increment_collection_views(uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_collection_saves(uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_collection_plan_adds(uuid) TO anon, authenticated;

-- ── Udostepnianie historycznej trasy: podpis + oznaczeni czlonkowie (#11) ─────
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS share_caption  text,
  ADD COLUMN IF NOT EXISTS tagged_members text[];
