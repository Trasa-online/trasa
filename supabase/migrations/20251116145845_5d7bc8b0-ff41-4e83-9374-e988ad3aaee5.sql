-- Create profiles table for public user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create routes table with status and ratings
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pins table with ratings
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  pin_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create followers junction table
CREATE TABLE public.followers (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create likes junction table
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

-- Create saved routes junction table
CREATE TABLE public.saved_routes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Routes policies
CREATE POLICY "Published routes are viewable by everyone" 
ON public.routes FOR SELECT USING (status = 'published' OR user_id = auth.uid());

CREATE POLICY "Users can create their own routes" 
ON public.routes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes" 
ON public.routes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routes" 
ON public.routes FOR DELETE USING (auth.uid() = user_id);

-- Pins policies
CREATE POLICY "Pins are viewable if route is viewable" 
ON public.pins FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = pins.route_id 
    AND (routes.status = 'published' OR routes.user_id = auth.uid())
  )
);

CREATE POLICY "Users can create pins for their routes" 
ON public.pins FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = pins.route_id 
    AND routes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update pins for their routes" 
ON public.pins FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = pins.route_id 
    AND routes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete pins for their routes" 
ON public.pins FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = pins.route_id 
    AND routes.user_id = auth.uid()
  )
);

-- Followers policies
CREATE POLICY "Followers are viewable by everyone" 
ON public.followers FOR SELECT USING (true);

CREATE POLICY "Users can follow others" 
ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" 
ON public.followers FOR DELETE USING (auth.uid() = follower_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone" 
ON public.likes FOR SELECT USING (true);

CREATE POLICY "Users can like routes" 
ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike routes" 
ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Saved routes policies
CREATE POLICY "Users can view their own saved routes" 
ON public.saved_routes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save routes" 
ON public.saved_routes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave routes" 
ON public.saved_routes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" 
ON public.comments FOR SELECT USING (true);

CREATE POLICY "Users can create comments" 
ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for routes updated_at
CREATE TRIGGER update_routes_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('route-images', 'route-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for route images
CREATE POLICY "Route images are publicly accessible" 
ON storage.objects FOR SELECT USING (bucket_id = 'route-images');

CREATE POLICY "Authenticated users can upload route images" 
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'route-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own route images" 
ON storage.objects FOR UPDATE USING (
  bucket_id = 'route-images' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own route images" 
ON storage.objects FOR DELETE USING (
  bucket_id = 'route-images' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for avatars
CREATE POLICY "Avatars are publicly accessible" 
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);