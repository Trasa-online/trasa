-- ─────────────────────────────────────────────────────────────────────────────
-- Bug: partycypant sesji grupowej nie dostawal kopii trasy po finalizacji przez
-- hosta. Klientowy member-loop (RouteSummaryDialog) wstawial trasy z user_id innego
-- usera, co bylo blokowane przez RLS (auth.uid()=user_id) i cicho padalo - host mial
-- trase, czlonkowie nie. Zamiast polegac na RLS + przekazywaniu otherMemberIds przez
-- nawigacje, robimy to server-side, atomowo, jednym RPC SECURITY DEFINER.
--
-- RPC kopiuje WSZYSTKIE trasy hosta z danej sesji (multi-day = kilka) do kazdego
-- czlonka (oprocz hosta), razem z pinami. Idempotentne: pomija czlonka, ktory juz
-- ma trase z tej sesji. Trigger notify_group_route_ready (20260406) odpala sie na
-- INSERT i powiadamia czlonka.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.copy_group_session_routes(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host        uuid := auth.uid();
  v_count       integer := 0;
  v_member      uuid;
  v_route       routes%rowtype;
  v_new_route   uuid;
BEGIN
  -- Tylko gospodarz (tworca) sesji moze kopiowac trasy dla czlonkow.
  IF NOT EXISTS (
    SELECT 1 FROM group_sessions
    WHERE id = p_session_id AND created_by = v_host
  ) THEN
    RAISE EXCEPTION 'Brak uprawnien: nie jestes gospodarzem tej sesji';
  END IF;

  FOR v_member IN
    SELECT user_id FROM group_session_members
    WHERE session_id = p_session_id
      AND user_id IS NOT NULL
      AND user_id <> v_host
  LOOP
    -- Idempotencja: czlonek ktory juz ma trase z tej sesji jest pomijany.
    IF EXISTS (
      SELECT 1 FROM routes
      WHERE group_session_id = p_session_id AND user_id = v_member
    ) THEN
      CONTINUE;
    END IF;

    -- Kopiuj kazda trase hosta z tej sesji (multi-day = kilka dni).
    FOR v_route IN
      SELECT * FROM routes
      WHERE group_session_id = p_session_id AND user_id = v_host
      ORDER BY day_number
    LOOP
      INSERT INTO routes (
        user_id, city, title, description, status, trip_type, folder_id, folder_order,
        day_number, start_date, end_date, pace, priorities, intent, ai_summary, ai_highlight,
        ai_tip, is_shared, group_session_id, starting_location_name, starting_location_lat,
        starting_location_lng, new_for_users
      ) VALUES (
        v_member, v_route.city, v_route.title, v_route.description, v_route.status, v_route.trip_type,
        v_route.folder_id, v_route.folder_order, v_route.day_number, v_route.start_date, v_route.end_date,
        v_route.pace, v_route.priorities, v_route.intent, v_route.ai_summary, v_route.ai_highlight,
        v_route.ai_tip, v_route.is_shared, v_route.group_session_id, v_route.starting_location_name,
        v_route.starting_location_lat, v_route.starting_location_lng, ARRAY[v_member]
      ) RETURNING id INTO v_new_route;

      INSERT INTO pins (
        route_id, place_name, address, description, image_url, pin_order, tags, latitude, longitude,
        category, place_id, photo_url, suggested_time, one_liner, original_creator_id, place_type
      )
      SELECT
        v_new_route, place_name, address, description, image_url, pin_order, tags, latitude, longitude,
        category, place_id, photo_url, suggested_time, one_liner, original_creator_id, place_type
      FROM pins WHERE route_id = v_route.id;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_group_session_routes(uuid) TO authenticated;
