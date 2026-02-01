-- ============================================
-- STEP 1: Create canonical_pins table
-- ============================================

-- Table for canonical pins (the actual physical locations)
CREATE TABLE IF NOT EXISTS canonical_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_name text NOT NULL,
  address text,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  discovered_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  discovered_at timestamp with time zone DEFAULT now(),
  total_visits integer DEFAULT 0,
  average_rating decimal(2, 1) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for fast location-based lookups (within 50m radius)
CREATE INDEX IF NOT EXISTS idx_canonical_pins_location ON canonical_pins (latitude, longitude);

-- Index for user lookups (who discovered what)
CREATE INDEX IF NOT EXISTS idx_canonical_pins_discoverer ON canonical_pins (discovered_by_user_id);

-- Index for name searches
CREATE INDEX IF NOT EXISTS idx_canonical_pins_name ON canonical_pins USING gin (to_tsvector('english', place_name));

-- Enable Row Level Security
ALTER TABLE canonical_pins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Canonical pins are viewable by everyone"
  ON canonical_pins FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create canonical pins"
  ON canonical_pins FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update canonical pins"
  ON canonical_pins FOR UPDATE
  USING (true);

-- ============================================
-- STEP 2: Add canonical_pin_id column to existing pins table
-- ============================================

-- Add foreign key to link pins to canonical pins
ALTER TABLE pins ADD COLUMN IF NOT EXISTS canonical_pin_id uuid REFERENCES canonical_pins(id) ON DELETE SET NULL;

-- Add visited_at timestamp to track when user visited
ALTER TABLE pins ADD COLUMN IF NOT EXISTS visited_at timestamp with time zone DEFAULT now();

-- Index for fast canonical pin lookups
CREATE INDEX IF NOT EXISTS idx_pins_canonical ON pins (canonical_pin_id);

-- Index for getting all visits to a canonical pin
CREATE INDEX IF NOT EXISTS idx_pins_canonical_visited ON pins (canonical_pin_id, visited_at DESC);

-- ============================================
-- STEP 3: Create helper function to find nearby canonical pins
-- ============================================

-- Function to find if a canonical pin exists within 50m of coordinates
CREATE OR REPLACE FUNCTION find_nearby_canonical_pin(
  search_lat decimal,
  search_lng decimal,
  radius_meters integer DEFAULT 50
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_pin_id uuid;
  lat_offset decimal;
  lng_offset decimal;
BEGIN
  -- Calculate degree offsets for given radius
  -- 1 degree latitude ≈ 111,320 meters
  lat_offset := radius_meters / 111320.0;
  
  -- 1 degree longitude varies by latitude
  -- At equator: 111,320 meters, shrinks toward poles
  lng_offset := radius_meters / (111320.0 * cos(radians(search_lat)));
  
  -- Find closest pin within bounding box
  SELECT id INTO found_pin_id
  FROM canonical_pins
  WHERE latitude BETWEEN (search_lat - lat_offset) AND (search_lat + lat_offset)
    AND longitude BETWEEN (search_lng - lng_offset) AND (search_lng + lng_offset)
  ORDER BY (
    -- Calculate actual distance using Pythagorean approximation
    -- For small distances (<1km), this is accurate enough
    sqrt(
      power((latitude - search_lat) * 111320, 2) +
      power((longitude - search_lng) * 111320 * cos(radians(search_lat)), 2)
    )
  )
  LIMIT 1;
  
  RETURN found_pin_id;
END;
$$;

-- ============================================
-- STEP 4: Create function to get canonical pin statistics
-- ============================================

-- Function to get stats for a canonical pin
CREATE OR REPLACE FUNCTION get_canonical_pin_stats(pin_id uuid)
RETURNS TABLE (
  total_visits bigint,
  average_rating numeric,
  unique_routes bigint,
  first_visit timestamp with time zone,
  latest_visit timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*)::bigint AS total_visits,
    avg(p.rating) AS average_rating,
    count(DISTINCT p.route_id)::bigint AS unique_routes,
    min(p.visited_at) AS first_visit,
    max(p.visited_at) AS latest_visit
  FROM pins p
  WHERE p.canonical_pin_id = pin_id;
END;
$$;

-- ============================================
-- STEP 5: Trigger to update average rating when visits change
-- ============================================

CREATE OR REPLACE FUNCTION update_canonical_pin_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE canonical_pins
  SET average_rating = (
    SELECT COALESCE(avg(rating), 0)
    FROM pins
    WHERE canonical_pin_id = NEW.canonical_pin_id
    AND rating > 0
  ),
  updated_at = now()
  WHERE id = NEW.canonical_pin_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS update_rating_on_pin_change ON pins;

CREATE TRIGGER update_rating_on_pin_change
  AFTER INSERT OR UPDATE OF rating ON pins
  FOR EACH ROW
  WHEN (NEW.canonical_pin_id IS NOT NULL)
  EXECUTE FUNCTION update_canonical_pin_rating();