-- Add original_creator_id to track who first discovered a location
ALTER TABLE public.pins 
ADD COLUMN original_creator_id uuid REFERENCES public.profiles(id);

-- Create index for faster location lookups
CREATE INDEX idx_pins_location ON public.pins (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create function to find original creator of a location (within ~50 meters)
CREATE OR REPLACE FUNCTION public.find_original_pin_creator(
  p_latitude numeric,
  p_longitude numeric
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  -- Find the earliest pin at approximately the same location (within ~50m radius)
  -- Using simple coordinate comparison: 0.0005 degrees ≈ 55 meters
  SELECT COALESCE(p.original_creator_id, r.user_id)
  INTO v_creator_id
  FROM pins p
  JOIN routes r ON r.id = p.route_id
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND ABS(p.latitude - p_latitude) < 0.0005
    AND ABS(p.longitude - p_longitude) < 0.0005
  ORDER BY p.created_at ASC
  LIMIT 1;
  
  RETURN v_creator_id;
END;
$$;

-- Backfill existing pins with original_creator_id based on location
UPDATE pins p
SET original_creator_id = (
  SELECT COALESCE(earliest.original_creator_id, r.user_id)
  FROM pins earliest
  JOIN routes r ON r.id = earliest.route_id
  WHERE earliest.latitude IS NOT NULL 
    AND earliest.longitude IS NOT NULL
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND ABS(earliest.latitude - p.latitude) < 0.0005
    AND ABS(earliest.longitude - p.longitude) < 0.0005
  ORDER BY earliest.created_at ASC
  LIMIT 1
)
WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL;