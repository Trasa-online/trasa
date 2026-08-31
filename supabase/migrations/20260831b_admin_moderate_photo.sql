-- Moderacja pojedynczego zdjecia UGC: usuwa URL ze WSZYSTKICH referencji (piny + listy
-- + place_photos) tak, ze znika z apki natychmiast. 'delete' vs 'hide' rozroznia audyt
-- (przy delete klient dodatkowo best-effort kasuje plik ze Storage). Gate: rola admin.
-- Metadata audytu trzyma URL, wiec ukrycie jest odzyskiwalne recznie.
CREATE OR REPLACE FUNCTION public.admin_moderate_photo(p_url text, p_action text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_refs int := 0; v_tmp int; v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_url IS NULL OR length(btrim(p_url)) = 0 THEN RETURN jsonb_build_object('refs', 0); END IF;

  UPDATE public.pins SET images = array_remove(images, p_url) WHERE p_url = ANY(images);
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;
  UPDATE public.pins SET user_photo_urls = array_remove(user_photo_urls, p_url) WHERE p_url = ANY(user_photo_urls);
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;
  UPDATE public.pins SET photo_url = NULL WHERE photo_url = p_url;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;
  UPDATE public.pins SET image_url = NULL WHERE image_url = p_url;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;
  UPDATE public.discovery_items SET photo_url = NULL WHERE photo_url = p_url;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;
  DELETE FROM public.place_photos WHERE photo_url = p_url;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_refs := v_refs + v_tmp;

  BEGIN SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  BEGIN
    INSERT INTO public.admin_audit_log(actor_id, actor_email, action, target_type, target_id, metadata)
    VALUES (auth.uid(), v_email, 'photo_' || coalesce(p_action, 'hide'), 'photo', left(p_url, 200),
            jsonb_build_object('reason', p_reason, 'refs', v_refs, 'url', p_url));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('refs', v_refs);
END; $func$;
GRANT EXECUTE ON FUNCTION public.admin_moderate_photo(text, text, text) TO authenticated;
