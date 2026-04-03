-- ─── generate_round_pool ──────────────────────────────────────────────────────
-- Generates a diversified pool of p_pool_size places for a given round.
-- Algorithm:
--   1. Exclude places shown in any previous round of this session.
--   2. Group remaining places by category.
--   3. Allocate floor(pool_size / category_count) slots per category (min 1).
--   4. Pick randomly within each category.
--   5. If total < pool_size: fill with any remaining unshown place.
--   6. If total > pool_size: trim randomly.
--   7. Final shuffle.

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
  v_collected     UUID[];
  v_extra         UUID[];
  v_result        UUID[];
  v_cat_rec       RECORD;
BEGIN
  SELECT city INTO v_city FROM group_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  -- Places already shown in earlier rounds
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

  -- Count distinct available categories
  SELECT COUNT(DISTINCT category) INTO v_cat_count
  FROM places
  WHERE city ILIKE v_city
    AND is_active = true
    AND id != ALL(v_already_shown);

  IF v_cat_count = 0 THEN RETURN '{}'::UUID[]; END IF;

  v_per_cat := GREATEST(1, p_pool_size / v_cat_count);

  -- Pick v_per_cat random places from each category
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

  -- Trim if over pool_size
  IF array_length(v_collected, 1) > p_pool_size THEN
    SELECT array_agg(id ORDER BY random()) INTO v_result
    FROM unnest(v_collected) AS id
    LIMIT p_pool_size;
  ELSE
    v_result := v_collected;
  END IF;

  -- Fill if under pool_size
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

  -- Final shuffle
  SELECT array_agg(id ORDER BY random()) INTO v_result
  FROM unnest(v_result) AS id;

  RETURN COALESCE(v_result, '{}'::UUID[]);
END;
$$;


-- ─── start_group_round ────────────────────────────────────────────────────────
-- Called by the session creator to begin round N.
-- Completes round N-1, generates a new pool, resets member round state.

CREATE OR REPLACE FUNCTION start_group_round(
  p_session_id   UUID,
  p_round_number INT DEFAULT 1
)
RETURNS UUID   -- new round id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id UUID;
  v_pool     UUID[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Only creator may start rounds
  IF NOT EXISTS (
    SELECT 1 FROM group_sessions
    WHERE id = p_session_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the session creator can start rounds';
  END IF;

  -- Generate diversified pool
  v_pool := generate_round_pool(p_session_id, p_round_number);
  IF array_length(v_pool, 1) IS NULL OR array_length(v_pool, 1) = 0 THEN
    RAISE EXCEPTION 'No available places for this round';
  END IF;

  -- Complete previous round (if any)
  UPDATE group_session_rounds
  SET status = 'completed'
  WHERE session_id = p_session_id
    AND round_number = p_round_number - 1
    AND status != 'completed';

  -- Insert new round
  INSERT INTO group_session_rounds (session_id, round_number, place_ids, status)
  VALUES (p_session_id, p_round_number, v_pool, 'active')
  RETURNING id INTO v_round_id;

  -- Reset per-round state for all active swipers
  UPDATE group_session_members
  SET current_round_done = false,
      current_round_vote = NULL
  WHERE session_id = p_session_id
    AND swiping_active = true;

  RETURN v_round_id;
END;
$$;

GRANT EXECUTE ON FUNCTION start_group_round(UUID, INT) TO authenticated;


-- ─── complete_round_for_user ──────────────────────────────────────────────────
-- Called when the current user finishes swiping all places in the round.
-- If every active member is done → move round to 'voting'.

CREATE OR REPLACE FUNCTION complete_round_for_user(
  p_session_id   UUID,
  p_round_number INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all_done BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE group_session_members
  SET current_round_done = true
  WHERE session_id = p_session_id AND user_id = auth.uid();

  -- Check if every active swiper is done
  SELECT NOT EXISTS (
    SELECT 1 FROM group_session_members
    WHERE session_id = p_session_id
      AND swiping_active = true
      AND current_round_done = false
  ) INTO v_all_done;

  IF v_all_done THEN
    UPDATE group_session_rounds
    SET status = 'voting'
    WHERE session_id = p_session_id
      AND round_number = p_round_number
      AND status = 'active';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_round_for_user(UUID, INT) TO authenticated;


-- ─── vote_on_round ────────────────────────────────────────────────────────────
-- Records the user's post-round decision.
-- 'opt_out' and 'finish' set swiping_active = false so they are excluded
-- from future rounds but remain session members.

CREATE OR REPLACE FUNCTION vote_on_round(
  p_session_id UUID,
  p_vote       TEXT   -- 'continue' | 'finish' | 'opt_out'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_vote NOT IN ('continue', 'finish', 'opt_out') THEN
    RAISE EXCEPTION 'Invalid vote value';
  END IF;

  UPDATE group_session_members
  SET current_round_vote = p_vote,
      swiping_active = (p_vote = 'continue')
  WHERE session_id = p_session_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION vote_on_round(UUID, TEXT) TO authenticated;
