-- Global registry of admin-approved custom subcategories
-- id = original label text (used directly for filtering in business_profiles.subcategories)
CREATE TABLE IF NOT EXISTS public.approved_subcategories (
  id TEXT PRIMARY KEY,             -- e.g. 'Wegańska restauracja' (same as label)
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✦',
  main_category_id TEXT NOT NULL,  -- 'food' | 'culture' | 'attractions' | 'nature'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.approved_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON public.approved_subcategories
  FOR SELECT USING (true);

CREATE POLICY "admin_write" ON public.approved_subcategories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
