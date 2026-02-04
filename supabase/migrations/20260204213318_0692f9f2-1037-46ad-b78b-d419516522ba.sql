-- Add note_type column to route_notes table
ALTER TABLE public.route_notes 
ADD COLUMN note_type text NOT NULL DEFAULT 'fact';

-- Add comment explaining the column
COMMENT ON COLUMN public.route_notes.note_type IS 
'Typ notatki: fact (ciekawostka), experience (doswiadczenie), tip (rada), warning (ostrzezenie)';