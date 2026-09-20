-- Podziekowanie od lokalu (prosba Nat 2026-09-15): lokal moze odpowiedziec czlowiekowi,
-- ktory zostawil notatke albo zdjecie o jego miejscu.
--
-- ⚠️ ADD VALUE do enuma MUSI wejsc osobna migracja, PRZED uzyciem wartosci: Postgres nie
-- pozwala uzyc swiezo dodanej etykiety w tej samej transakcji (patrz CLAUDE.md).

alter type public.notification_type add value if not exists 'business_thanks';
