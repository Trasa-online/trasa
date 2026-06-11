-- [H3] increment_route_views inkrementowal DOWOLNY route_id (takze prywatny,
-- nieudostepniony) bez throttlingu, a od 20260611 dostepny dla anon -> dowolny
-- gosc mogl w petli windowac licznik dowolnej trasy. Gatujemy do tras
-- udostepnionych (is_shared). Dedup per-widz robimy po stronie klienta
-- (SharedRoute, localStorage) zeby nie zawyzac "X osob obejrzalo".
CREATE OR REPLACE FUNCTION public.increment_route_views(route_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.routes
  SET views = views + 1
  WHERE id = route_id AND is_shared = true;
END;
$$;
