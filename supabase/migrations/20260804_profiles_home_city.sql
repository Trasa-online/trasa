-- Miasto (i kraj) zamieszkania usera - ustawiane w onboardingu (krok "Gdzie mieszkasz").
-- ProfileSetup pisal je best-effort; dodajemy kolumny na pewno.
alter table public.profiles add column if not exists home_city text;
alter table public.profiles add column if not exists home_country text;
