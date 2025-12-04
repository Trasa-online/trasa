-- Add columns for visit details
ALTER TABLE public.pin_visits
ADD COLUMN image_url text,
ADD COLUMN description text,
ADD COLUMN rating integer CHECK (rating >= 1 AND rating <= 5);

-- Allow users to update their own visits
CREATE POLICY "Users can update their visit"
ON public.pin_visits
FOR UPDATE
USING (auth.uid() = user_id);