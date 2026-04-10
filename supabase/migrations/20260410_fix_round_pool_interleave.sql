-- Fix generate_round_pool: interleave categories in the output order
-- so the swipe queue shows a variety of place types, not one category at a time.
-- Also fixes the issue where round 2 could show round 1 places
-- (the exclusion logic was correct; this migration replaces the function to ensure it's up to date).

CREATE OR REPLACE FUNCTION generate_round_pool(
  p_session_id  UUID,
  p_round_number INT,
  p_pool_size   INT DEFAULT 20
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
  v_cats          TEXT[];
  v_cat           TEXT;
  v_cat_places    UUID[];
  v_buckets       UUID[][];   -- one sub-array per category
  v_result        UUID[];
  v_max_len       INT := 0;
  v_bucket_len    INT;
  i               INT;
BEGIN
  SELECT city INTO v_city FROM group_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  -- Places shown in any earlier round
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

  -- Distinct categories available
  SELECT array_agg(DISTINCT category ORDER BY category) INTO v_cats
  FROM places
  WHERE city ILIKE v_city
    AND is_active = true
    AND id != ALL(v_already_shown);

  v_cat_count := COALESCE(array_length(v_cats, 1), 0);
  IF v_cat_count = 0 THEN RETURN '{}'::UUID[]; END IF;

  v_per_cat := GREATEST(1, p_pool_size / v_cat_count);

  -- Build one shuffled bucket per category
  v_buckets := '{}'::UUID[][];
  FOR i IN 1 .. v_cat_count LOOP
    v_cat := v_cats[i];
    SELECT array_agg(id ORDER BY random()) INTO v_cat_places
    FROM places
    WHERE city ILIKE v_city
      AND is_active = true
      AND id != ALL(v_already_shown)
      AND category = v_cat
    LIMIT v_per_cat;

    v_buckets := v_buckets || ARRAY[COALESCE(v_cat_places, '{}'::UUID[])];
    v_bucket_len := COALESCE(array_length(v_cat_places, 1), 0);
    IF v_bucket_len > v_max_len THEN v_max_len := v_bucket_len; END IF;
  END LOOP;

  -- Interleave: pick one place from each category in round-robin order
  -- Result: restaurant, cafe, museum, restaurant, cafe, museum, ...
  v_result := '{}'::UUID[];
  FOR i IN 1 .. v_max_len LOOP
    FOR j IN 1 .. v_cat_count LOOP
      IF i <= COALESCE(array_length(v_buckets[j], 1), 0) THEN
        v_result := v_result || ARRAY[v_buckets[j][i]];
      END IF;
      EXIT WHEN array_length(v_result, 1) >= p_pool_size;
    END LOOP;
    EXIT WHEN COALESCE(array_length(v_result, 1), 0) >= p_pool_size;
  END LOOP;

  -- Trim if somehow over limit
  IF COALESCE(array_length(v_result, 1), 0) > p_pool_size THEN
    SELECT array_agg(id) INTO v_result
    FROM (SELECT unnest(v_result) AS id LIMIT p_pool_size) sub;
  END IF;

  RETURN COALESCE(v_result, '{}'::UUID[]);
END;
$$;
