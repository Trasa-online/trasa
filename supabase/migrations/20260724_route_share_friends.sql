-- Trzeci poziom widocznosci wyjazdu (obok is_shared publiczne / prywatne): "Bliscy znajomi".
-- Ustawienia prywatnosci: Tylko ja (is_shared=false, share_friends=false) / Bliscy znajomi
-- (is_shared=false, share_friends=true) / Wszyscy (is_shared=true).
-- Egzekwowanie widocznosci dla znajomych (RLS / feed) dochodzi osobno - tu tylko trwaly zapis wyboru.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS share_friends boolean NOT NULL DEFAULT false;
