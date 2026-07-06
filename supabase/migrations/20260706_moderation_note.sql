-- Notka moderatora przy odrzuceniu zestawienia (powod widoczny dla autora).
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS moderation_note text;
