-- RECZNE UZUPELNIENIE RACHUNKU GOOGLE SPRZED EKSPORTU (zgloszenie Nat 2026-09-24:
-- „na panelu admina caly czas blednie wyswietlana jest kwota dla Google Cloud").
--
-- Panel pokazywal 18,16 zl, a konsola Google ~43 zl - i OBIE liczby byly prawdziwe.
-- Eksport rozliczen do BigQuery ruszyl 20.09 i Google NIE uzupelnia go wstecz, wiec dni
-- 1-19 wrzesnia po prostu nie istnieja w naszym zrodle. Panel od 23.09 pisal o tym w banerze,
-- ale wielka liczba na gorze dalej nie zgadzala sie z ta, ktora Nat widzi w Google - a to ona
-- jest punktem odniesienia.
--
-- Nie da sie tego dociagnac zapytaniem: Cloud Billing API nie oddaje kosztow (tylko cennik),
-- a eksport zaczyna sie od dnia wlaczenia. Jedyne uczciwe wyjscie to RECZNE uzupelnienie
-- brakujacego kawalka - z konsoli, RAZ, dla tego jednego miesiaca.
--
-- ⚠️ Kwota trzymana OSOBNO, nie dosypana do `google_billing_daily`: tamta tabela ma byc
-- surowym eksportem Google. Wpis reczny jest oznaczony i widac go w panelu jako osobna
-- pozycje - inaczej za pol roku nikt nie odrozni danych od szacunku.
-- ⛔ Od pazdziernika ta tabela ma byc PUSTA - eksport pokrywa wtedy caly miesiac.

CREATE TABLE IF NOT EXISTS public.google_billing_manual (
  month       date PRIMARY KEY,          -- pierwszy dzien miesiaca
  amount      numeric(12,2) NOT NULL,    -- kwota NETTO (do zaplaty) za dni spoza eksportu
  note        text,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_billing_manual ENABLE ROW LEVEL SECURITY;

-- Tylko admin (panel ops). Zwykly user nie ma tu czego szukac - to dane rozliczeniowe firmy.
DROP POLICY IF EXISTS billing_manual_admin_read ON public.google_billing_manual;
CREATE POLICY billing_manual_admin_read ON public.google_billing_manual FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS billing_manual_admin_write ON public.google_billing_manual;
CREATE POLICY billing_manual_admin_write ON public.google_billing_manual FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
