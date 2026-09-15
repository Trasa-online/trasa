-- Atomowa podmiana pinów trasy: delete + insert w JEDNEJ transakcji funkcji.
-- Prewencja krytycznego buga (2026-08-13): przy edycji trasy delete przechodził, a reinsert
-- padał na constraint -> UTRATA wszystkich miejsc. Funkcja jest atomowa: jak insert padnie,
-- cała operacja (w tym DELETE) się wycofuje, piny zostają nietknięte.
-- SECURITY INVOKER (domyślnie) -> RLS działa: user podmienia piny TYLKO swojej trasy.
CREATE OR REPLACE FUNCTION public.replace_route_pins(p_route_id uuid, p_pins jsonb)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  DELETE FROM public.pins WHERE route_id = p_route_id;
  IF jsonb_array_length(coalesce(p_pins, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.pins (
      route_id, place_name, address, description, category, latitude, longitude,
      place_id, suggested_time, pin_order, photo_url, images, user_photo_urls,
      image_url, photo_cached_at, original_creator_id
    )
    SELECT p_route_id, x.place_name, coalesce(x.address,''), x.description, coalesce(x.category,'other'),
           x.latitude, x.longitude, x.place_id, x.suggested_time, x.pin_order, x.photo_url,
           coalesce(x.images, '{}'::text[]), coalesce(x.user_photo_urls, '{}'::text[]),
           x.image_url, x.photo_cached_at, x.original_creator_id
    FROM jsonb_to_recordset(p_pins) AS x(
      place_name text, address text, description text, category text,
      latitude double precision, longitude double precision, place_id text,
      suggested_time text, pin_order int, photo_url text,
      images text[], user_photo_urls text[], image_url text,
      photo_cached_at timestamptz, original_creator_id uuid
    );
  END IF;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.replace_route_pins(uuid, jsonb) TO authenticated;
