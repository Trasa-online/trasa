-- Create table for visit comments
CREATE TABLE public.visit_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_pin_id uuid NOT NULL,
  visit_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for visit likes
CREATE TABLE public.visit_likes (
  visit_pin_id uuid NOT NULL,
  visit_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (visit_pin_id, visit_user_id, user_id)
);

-- Enable RLS
ALTER TABLE public.visit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for visit_comments
CREATE POLICY "Visit comments are viewable by everyone"
  ON public.visit_comments FOR SELECT USING (true);

CREATE POLICY "Users can create visit comments"
  ON public.visit_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visit comments"
  ON public.visit_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own visit comments"
  ON public.visit_comments FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for visit_likes
CREATE POLICY "Visit likes are viewable by everyone"
  ON public.visit_likes FOR SELECT USING (true);

CREATE POLICY "Users can like visits"
  ON public.visit_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike visits"
  ON public.visit_likes FOR DELETE USING (auth.uid() = user_id);