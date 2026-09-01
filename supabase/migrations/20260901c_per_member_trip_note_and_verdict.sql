-- WŁASNE rzeczy uczestnika wyjazdu (prosba Nat 2026-09-01). Kazdy uczestnik ma swoja okladke,
-- swoja notke o calym wyjezdzie i swoj werdykt o kazdym miejscu - wybor jednej osoby nie zmienia
-- tego, co widza pozostali.

-- 1) NOTKA O CALYM WYJEZDZIE, per uczestnik. Dosiada do route_member_covers, bo to juz jest
--    tabela "moje rzeczy w tym wyjezdzie" (PK route_id+user_id, RLS: czytaja uczestnicy,
--    pisze wylacznie wlasciciel wiersza). Osobna tabela dublowalaby te same polityki.
--    cover_url przestaje byc NOT NULL - uczestnik moze miec sama notke, bez wlasnej okladki.
alter table public.route_member_covers alter column cover_url drop not null;
alter table public.route_member_covers add column if not exists note text;

comment on table public.route_member_covers is
  'Rzeczy uczestnika wyjazdu widoczne TYLKO u niego: wlasna okladka (cover_url) i wlasna notka o wyjezdzie (note). Brak wiersza = okladka i opis od hosta.';

-- 2) WERDYKT O MIEJSCU, per uczestnik ("Musisz odwiedzić!" / "Przy okazji" / "Warto wpaść").
--    Dotad werdykt siedzial w pins.tags, czyli w JEDNEJ tablicy na pinie - kazdy uczestnik
--    nadpisywal opinie pozostalych. pin_ratings ma juz wiersz per (user, miejsce) z notka,
--    wiec werdykt trafia obok niej i jest naturalnie prywatny dla autora.
--    Bez CHECK na slownik: pula chipow zyje w src/lib/routeTags.ts i bywa zmieniana, a twardy
--    constraint w bazie zamienilby taka zmiane w blad zapisu na produkcji.
alter table public.pin_ratings add column if not exists verdict text;

comment on column public.pin_ratings.verdict is
  'Werdykt uczestnika o miejscu: id z PLACE_VERDICT_TAGS (must_visit | worth_seeing | stop_by). NULL = brak zdania.';
