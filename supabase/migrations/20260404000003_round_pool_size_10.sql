-- Change default round pool size from 20 to 10 places
CREATE OR REPLACE FUNCTION generate_round_pool(
  p_session_id   UUID,
  p_round_number INT,
  p_pool_size    INT DEFAULT 10
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city          TEXT;
  v_already_shown UUID[];
  v_cat_count     INT;
  v_per_cat       INT;
  v_collected     UUID[];
  v_extra         UUID[];
  v_result        UUID[];
  v_cat_rec       RECORD;
BEGIN
  SELECT city INTO v_city FROM group_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  SELECT COALESCE(
    (SELECT array_agg(pid)
     FROM (
       SELECT unnest(place_ids) AS pid
       FROM group_session_rounds
       WHERE session_id = p_session_id
         AND round_number < p_round_number
     ) sub),
    '{}'::UUID[]
  ) INTO v_already_shown;

  SELECT COUNT(DISTINCT category) INTO v_cat_count
  FROM places
  WHERE city ILIKE v_city
    AND is_active = true
    AND id != ALL(v_already_shown);

  IF v_cat_count = 0 THEN RETURN '{}'::UUID[]; END IF;

  v_per_cat := GREATEST(1, p_pool_size / v_cat_count);

  v_collected := '{}'::UUID[];
  FOR v_cat_rec IN
    SELECT category,
           array_agg(id ORDER BY random()) AS ids
    FROM places
    WHERE city ILIKE v_city
      AND is_active = true
      AND id != ALL(v_already_shown)
    GROUP BY category
  LOOP
    v_collected := v_collected
      || v_cat_rec.ids[1 : LEAST(v_per_cat, array_length(v_cat_rec.ids, 1))];
  END LOOP;

  IF array_length(v_collected, 1) > p_pool_size THEN
    SELECT array_agg(id ORDER BY random()) INTO v_result
    FROM unnest(v_collected) AS id
    LIMIT p_pool_size;
  ELSE
    v_result := v_collected;
  END IF;

  IF COALESCE(array_length(v_result, 1), 0) < p_pool_size THEN
    SELECT array_agg(id ORDER BY random()) INTO v_extra
    FROM places
    WHERE city ILIKE v_city
      AND is_active = true
      AND id != ALL(v_already_shown)
      AND id != ALL(COALESCE(v_result, '{}'::UUID[]))
    LIMIT p_pool_size - COALESCE(array_length(v_result, 1), 0);

    v_result := COALESCE(v_result, '{}'::UUID[]) || COALESCE(v_extra, '{}'::UUID[]);
  END IF;

  SELECT array_agg(id ORDER BY random()) INTO v_result
  FROM unnest(v_result) AS id;

  RETURN COALESCE(v_result, '{}'::UUID[]);
END;
$$;
