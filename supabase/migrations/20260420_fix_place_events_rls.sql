-- Fix place_events INSERT policy:
-- Allow anon + authenticated inserts so guest views are tracked too.
-- Drop the old policy that required auth.uid() IS NOT NULL (blocked guest tracking).
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.place_events;

CREATE POLICY "Anyone can insert events"
  ON public.place_events FOR INSERT WITH CHECK (true);
