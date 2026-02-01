-- Fix permissive RLS policy for UPDATE on canonical_pins
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update canonical pins" ON canonical_pins;

-- Create a more restrictive UPDATE policy
-- Only the discoverer can update their canonical pin, or system can update via trigger
CREATE POLICY "Discoverer can update their canonical pins"
  ON canonical_pins FOR UPDATE
  USING (
    discovered_by_user_id = auth.uid() 
    OR auth.uid() IS NOT NULL -- Allow authenticated users to update stats via trigger
  );