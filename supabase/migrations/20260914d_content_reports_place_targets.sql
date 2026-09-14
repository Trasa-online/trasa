-- Sekcja "Od użytkowników" w panelu lokalu (2026-09-14): biznes widzi notki i zdjęcia userów
-- o swoim miejscu i może je ZGŁOSIĆ do moderacji. content_reports miało target_type ograniczony
-- do route/collection/user - dodajemy zdjęcie i notkę użytkownika o miejscu.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['route'::text, 'collection'::text, 'user'::text, 'place_photo'::text, 'place_note'::text]));
