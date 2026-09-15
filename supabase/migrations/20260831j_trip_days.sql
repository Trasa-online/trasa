-- PODZIAL WYJAZDU NA DNI (prosba Nat 2026-08-31).
-- Model: wyjazd dostaje date KONCA (end_date), a kazde miejsce numer dnia (pins.day_index).
--  - data NIE wybrana        -> widok bez zmian (plaska lista miejsc),
--  - zakres 1-dniowy         -> tez plasko (nie ma czego dzielic),
--  - zakres wielodniowy      -> naglowki "Dzien 1..N" i miejsca przypisane recznie (drag).
-- To NIE jest stary model wielodniowy (folder_id + osobny wiersz routes na kazdy dzien) -
-- tu caly wyjazd zostaje JEDNYM wierszem, dni sa tylko podzialem miejsc w srodku.
alter table public.routes add column if not exists end_date date;
alter table public.pins  add column if not exists day_index smallint;

-- Domyslnie wszystko w pierwszym dniu; NULL czytamy w aplikacji jako dzien 1.
create index if not exists pins_route_day_idx on public.pins (route_id, day_index, pin_order);
