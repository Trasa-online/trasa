-- Route sharing: allow users to share a read-only public link

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Allow anyone (including unauthenticated) to read shared routes
CREATE POLICY "Public can read shared routes"
  ON public.routes FOR SELECT
  USING (is_shared = true);

-- Allow anyone to read pins of shared routes
CREATE POLICY "Public can read pins of shared routes"
  ON public.pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_id AND r.is_shared = true
    )
  );
