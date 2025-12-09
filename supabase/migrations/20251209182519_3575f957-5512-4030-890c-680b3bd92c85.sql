-- Modify route_notes table to associate notes with pins instead of position
-- First, drop the existing data since we're changing the structure
DELETE FROM public.route_notes;

-- Add pin_id column and note_order for ordering within a pin
ALTER TABLE public.route_notes 
ADD COLUMN pin_id uuid REFERENCES public.pins(id) ON DELETE CASCADE,
ADD COLUMN note_order integer NOT NULL DEFAULT 0;

-- Drop the old after_pin_index column
ALTER TABLE public.route_notes 
DROP COLUMN after_pin_index;

-- Update RLS policies to reference pins table
DROP POLICY IF EXISTS "Notes viewable if route viewable" ON public.route_notes;
DROP POLICY IF EXISTS "Users can create notes for their routes" ON public.route_notes;
DROP POLICY IF EXISTS "Users can delete notes from their routes" ON public.route_notes;
DROP POLICY IF EXISTS "Users can update notes on their routes" ON public.route_notes;

-- Create new policies that check ownership via pin -> route relationship
CREATE POLICY "Notes viewable if route viewable" 
ON public.route_notes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM pins p
    JOIN routes r ON r.id = p.route_id
    WHERE p.id = route_notes.pin_id 
    AND (r.status = 'published' OR r.user_id = auth.uid())
  )
);

CREATE POLICY "Users can create notes for their pins" 
ON public.route_notes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pins p
    JOIN routes r ON r.id = p.route_id
    WHERE p.id = route_notes.pin_id 
    AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete notes from their pins" 
ON public.route_notes 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM pins p
    JOIN routes r ON r.id = p.route_id
    WHERE p.id = route_notes.pin_id 
    AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update notes on their pins" 
ON public.route_notes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM pins p
    JOIN routes r ON r.id = p.route_id
    WHERE p.id = route_notes.pin_id 
    AND r.user_id = auth.uid()
  )
);