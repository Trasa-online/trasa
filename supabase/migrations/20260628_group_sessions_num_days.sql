-- Multi-day dla sesji grupowych: liczba dni trasy (host ustawia przy tworzeniu sesji).
-- Trasa proponowana z sesji dziedziczy num_days -> RouteSummaryDialog tworzy folder
-- z wieloma dniami (jak solo multi-day).
ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS num_days INT DEFAULT 1;
