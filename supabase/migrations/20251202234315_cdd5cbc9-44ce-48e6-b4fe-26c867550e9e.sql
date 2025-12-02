-- Create route_notes table for storing "ciekawe na trasie" notes
CREATE TABLE public.route_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  after_pin_index INTEGER NOT NULL,
  text TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.route_notes ENABLE ROW LEVEL SECURITY;

-- Notes are viewable if route is viewable
CREATE POLICY "Notes viewable if route viewable" ON public.route_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routes 
      WHERE routes.id = route_notes.route_id 
      AND (routes.status = 'published' OR routes.user_id = auth.uid())
    )
  );

-- Users can create notes for their routes
CREATE POLICY "Users can create notes for their routes" ON public.route_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routes 
      WHERE routes.id = route_notes.route_id 
      AND routes.user_id = auth.uid()
    )
  );

-- Users can delete notes from their routes
CREATE POLICY "Users can delete notes from their routes" ON public.route_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.routes 
      WHERE routes.id = route_notes.route_id 
      AND routes.user_id = auth.uid()
    )
  );

-- Users can update notes on their routes
CREATE POLICY "Users can update notes on their routes" ON public.route_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.routes 
      WHERE routes.id = route_notes.route_id 
      AND routes.user_id = auth.uid()
    )
  );