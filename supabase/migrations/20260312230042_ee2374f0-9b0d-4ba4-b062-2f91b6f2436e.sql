-- Tabela creator_plans
CREATE TABLE public.creator_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_handle TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dodaj plan_id do creator_places
ALTER TABLE public.creator_places
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.creator_plans(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.creator_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Każdy może czytać aktywne plany"
  ON public.creator_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin może wszystko z planami"
  ON public.creator_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));