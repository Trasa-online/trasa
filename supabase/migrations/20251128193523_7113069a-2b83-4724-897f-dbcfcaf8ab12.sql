-- Add tags, transport fields to pins table
ALTER TABLE public.pins 
ADD COLUMN tags text[] DEFAULT '{}',
ADD COLUMN is_transport boolean DEFAULT false,
ADD COLUMN transport_type text,
ADD COLUMN transport_end text;

-- Add comment for clarity
COMMENT ON COLUMN public.pins.tags IS 'Array of tags like Wege, Kawiarnia, etc.';
COMMENT ON COLUMN public.pins.is_transport IS 'Whether this pin represents transportation';
COMMENT ON COLUMN public.pins.transport_type IS 'Type of transport: Samochód, Tramwaj, etc.';
COMMENT ON COLUMN public.pins.transport_end IS 'End point when is_transport is true (place_name is start point)';