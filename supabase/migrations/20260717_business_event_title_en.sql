-- Auto-tlumaczenie EN tresci wydarzen biznesowych (pomaranczowy pill = event_title)
-- z mozliwoscia recznego nadpisania przez lokal.
--
-- event_title_en             - tlumaczenie EN (auto z edge function translate-content LUB reczne)
-- event_title_en_overridden  - true gdy lokal recznie poprawil EN (wtedy NIE nadpisujemy auto)
--
-- Wizytowka pokazuje event_title_en gdy user ma EN i pole niepuste, inaczej fallback do PL.

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS event_title_en text,
  ADD COLUMN IF NOT EXISTS event_title_en_overridden boolean NOT NULL DEFAULT false;

-- RLS: kolumny dziedzicza istniejace polityki business_profiles (owner update) - bez zmian.
