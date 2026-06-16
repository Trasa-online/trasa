-- Personalizacja koloru badge promocji/aktualnosci na wizytowce biznesu.
-- NULL/puste = domyslny gradient pomaranczowy (#F4A259 -> #F9662B), zachowanie sprzed zmiany.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS color_promo text;
