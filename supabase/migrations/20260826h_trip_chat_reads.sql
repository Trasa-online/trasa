-- Licznik nieprzeczytanych wiadomosci czatu (2026-08-26): kropka/liczba na dymku, gdy ktos napisal.
-- trip_chat_reads = ostatni raz gdy user otworzyl czat danego wyjazdu. Nieprzeczytane = wiadomosci
-- (nie moje) po last_read_at.
CREATE TABLE IF NOT EXISTS public.trip_chat_reads (
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);
ALTER TABLE public.trip_chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own chat reads" ON public.trip_chat_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
