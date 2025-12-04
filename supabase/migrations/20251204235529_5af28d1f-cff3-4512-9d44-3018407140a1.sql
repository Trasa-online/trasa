-- Add foreign key constraint from pin_visits.user_id to profiles.id
ALTER TABLE public.pin_visits
ADD CONSTRAINT pin_visits_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;