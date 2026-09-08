-- Topka miejsc z wyjazdu (2026-09-08, zgloszenie z testow)
--
-- Autor wyjazdu recznie wskazuje miejsca warte polecenia (1-3, zaleznie od dlugosci trasy).
-- To WYBOR autora, nie wyliczenie z ocen - w wyjezdzie wspolnym "top" moglby znaczyc
-- "najwyzej oceniane przez grupe", ale Nat potwierdzila wersje reczna (2026-09-08).
--
-- Boolean, nie ranking 1/2/3: chodzi o wyroznienie gwiazdka, a nie o kolejnosc miedzy
-- wyroznionymi. Limit (ile gwiazdek wolno) zalezy od liczby miejsc i pilnuje go klient -
-- to reguła prezentacji, nie niezmiennik danych, wiec nie zaklada sie jej wyzwalaczem.
alter table public.pins
  add column if not exists is_top boolean not null default false;

comment on column public.pins.is_top is
  'Miejsce wyroznione przez autora wyjazdu ("topka"). Limit 1-3 wg liczby miejsc pilnuje klient.';

create index if not exists pins_route_top_idx on public.pins (route_id) where is_top;
