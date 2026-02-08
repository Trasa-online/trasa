
-- Create route_folders table
CREATE TABLE public.route_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_image_url text,
  folder_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add folder columns to routes
ALTER TABLE public.routes
ADD COLUMN folder_id uuid REFERENCES public.route_folders(id) ON DELETE SET NULL,
ADD COLUMN folder_order integer DEFAULT 0;

-- Enable RLS
ALTER TABLE public.route_folders ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Folder owner full access" ON public.route_folders
  FOR ALL USING (auth.uid() = user_id);

-- Public can view folders with published routes
CREATE POLICY "Public folders viewable" ON public.route_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routes 
      WHERE routes.folder_id = route_folders.id 
      AND routes.status = 'published'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_route_folders_updated_at
  BEFORE UPDATE ON public.route_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
