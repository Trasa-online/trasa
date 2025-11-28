-- Add rating column to routes table
ALTER TABLE public.routes 
ADD COLUMN rating numeric(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

COMMENT ON COLUMN public.routes.rating IS 'Overall rating of the route (0-5 with 0.5 increments)';
