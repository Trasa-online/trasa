-- Create table to track pin visits by users
CREATE TABLE public.pin_visits (
  pin_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (pin_id, user_id)
);

-- Add foreign key to pins table
ALTER TABLE public.pin_visits
  ADD CONSTRAINT pin_visits_pin_id_fkey FOREIGN KEY (pin_id) REFERENCES public.pins(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.pin_visits ENABLE ROW LEVEL SECURITY;

-- Pin visits are viewable by everyone
CREATE POLICY "Pin visits are viewable by everyone"
ON public.pin_visits
FOR SELECT
USING (true);

-- Users can mark pins as visited
CREATE POLICY "Users can mark pins as visited"
ON public.pin_visits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their visit
CREATE POLICY "Users can remove their visit"
ON public.pin_visits
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_pin_visits_pin_id ON public.pin_visits(pin_id);