-- Create enum for trip types
CREATE TYPE public.trip_type AS ENUM ('planning', 'ongoing', 'completed');

-- Add trip_type column to routes table
ALTER TABLE public.routes 
ADD COLUMN trip_type public.trip_type DEFAULT 'completed';