-- Add trip support by extending route_folders
ALTER TABLE public.route_folders ADD COLUMN IF NOT EXISTS is_trip boolean DEFAULT false;
ALTER TABLE public.route_folders ADD COLUMN IF NOT EXISTS num_days integer DEFAULT 1;

-- Add day_number to routes for trip-day association
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS day_number integer;
