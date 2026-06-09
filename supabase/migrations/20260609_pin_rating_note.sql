-- Per-place user note (rada/notka) in the journal "wspomnienie" view.
-- Stored alongside the star rating, keyed by (route_id, user_id, place_name).
ALTER TABLE public.pin_ratings ADD COLUMN IF NOT EXISTS note text;
