-- Data planowanego wyjazdu przy zapisanej trasie (2026-09-08, zgloszenie z testow)
--
-- "Zapisz trase" w widoku cudzego wyjazdu dzialalo INACZEJ niz ten sam zapis na karcie
-- w eksploracji: karta dodawala wpis do Zapisanych, a widok wyjazdu KOPIOWAL cala trase
-- z pinami do wlasnych roboczych i przerzucal usera na stary ekran podsumowania. Dwa
-- rozne zachowania pod ta sama nazwa.
--
-- Ujednolicone na zapis do Zapisanych. Wybor daty zostaje (podobal sie), wiec potrzebuje
-- miejsca - dotad ladowal w skopiowanej trasie, ktorej juz nie tworzymy.
alter table public.saved_routes
  add column if not exists planned_date date;

comment on column public.saved_routes.planned_date is
  'Kiedy uzytkownik planuje przejsc te trase. Nalezy do ZAPISUJACEGO, nie do trasy - autor jej nie widzi.';

-- Brakowalo polityki UPDATE: bez niej zmiana daty przy JUZ zapisanej trasie (upsert
-- trafiajacy w konflikt) konczy sie odmowa. Zapis nadal wylacznie wlasnych wierszy.
drop policy if exists "Users can update their saved routes" on public.saved_routes;
create policy "Users can update their saved routes" on public.saved_routes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
