-- Add latitude and longitude columns to pins table
ALTER TABLE public.pins 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);