-- Jezyk zapisu na waitliste (2026-09-06). Landing wykrywa jezyk odwiedzajacego, wiec
-- mail powitalny i pozniejsze zaproszenie na premiere maja isc w TYM SAMYM jezyku,
-- w ktorym user widzial strone - a nie zawsze po polsku.
alter table public.waitlist add column if not exists language text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_language_check') then
    alter table public.waitlist add constraint waitlist_language_check
      check (language is null or language in ('pl','en'));
  end if;
end $$;

comment on column public.waitlist.language is
  'Jezyk landingu w momencie zapisu (pl|en). NULL = zapisy sprzed tej zmiany, traktujemy jak polski.';
