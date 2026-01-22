-- Allow anyone to count waitlist entries (for displaying counter on public page)
CREATE POLICY "Anyone can count waitlist entries"
ON public.waitlist
FOR SELECT
USING (true);