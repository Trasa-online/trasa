-- Add views column to routes table
ALTER TABLE routes ADD COLUMN views INTEGER DEFAULT 0 NOT NULL;

-- Create function to increment route views
CREATE OR REPLACE FUNCTION increment_route_views(route_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE routes
  SET views = views + 1
  WHERE id = route_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_route_views TO authenticated;