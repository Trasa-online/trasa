ALTER TABLE public.route_folders
  ADD CONSTRAINT route_folders_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;