-- Ukrycie kont biznesowych z wyszukiwarki userów (search pokazuje tylko realnych ludzi).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_from_search boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET hide_from_search = true
  WHERE username IN ('mathieu.bialecki', 'wanderlustcoffeeplace');
