-- Add mentioned_users column to pins table
ALTER TABLE public.pins 
ADD COLUMN mentioned_users uuid[] DEFAULT '{}';

COMMENT ON COLUMN public.pins.mentioned_users IS 'Array of user IDs who were mentioned/tagged in this pin';
