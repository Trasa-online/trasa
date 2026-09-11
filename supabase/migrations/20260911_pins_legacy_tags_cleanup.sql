-- Czyszczenie STARYCH tagow miejsc na wyjazdach (zgloszenie Nat 2026-09-11:
-- "w niektorych wyjazdach sa nadal stare tagi do miejsc, usun je - np. Trip do Wro").
--
-- Kolumna `pins.tags` przeszla dwie zmiany modelu i zostaly w niej osady po obu:
--  1. Opisowe tagi miejsca ("Dobra kawa", "Must-see", "Klimatyczne wnetrza") - edytor
--     tych tagow wyszedl z widoku wyjazdu; pola nie da sie juz ustawic, a pigulki
--     nadal renderowaly sie na wierszu miejsca.
--  2. Wycofane werdykty ("Warto odwiedzic", "Nie warto odwiedzac") - zdjete z puli
--     PLACE_VERDICT_TAGS, wiec rowniez nie do odtworzenia z aplikacji.
--
-- Zostaja WYLACZNIE zyjace werdykty (must_visit / worth_seeing / stop_by), bo to
-- aktywna funkcja widoku wyjazdu. Przy okazji przechodza ze starego zapisu (polska
-- etykieta) na ID - tak zapisuje je dzisiejszy kod, wiec wyjazd czyta sie poprawnie
-- takze po angielsku.
--
-- Cofniecie: kopia sprzed czyszczenia siedzi w public.pins_tags_backup_20260911.
-- Przywrocenie: update pins p set tags = b.tags from pins_tags_backup_20260911 b
--               where b.pin_id = p.id;

create table if not exists public.pins_tags_backup_20260911 (
  pin_id uuid primary key,
  tags   text[],
  saved_at timestamptz not null default now()
);
-- Backup tylko dla wierszy, ktore faktycznie tykamy.
insert into public.pins_tags_backup_20260911 (pin_id, tags)
select p.id, p.tags from public.pins p
where p.tags is not null and array_length(p.tags, 1) > 0
on conflict (pin_id) do nothing;

update public.pins p
set tags = nullif(
  (
    select coalesce(array_agg(distinct m), '{}'::text[])
    from (
      select case tg
        when 'Musisz odwiedzić!' then 'must_visit'
        when 'Przy okazji'       then 'worth_seeing'
        when 'Warto wpaść'       then 'stop_by'
        when 'must_visit'        then 'must_visit'
        when 'worth_seeing'      then 'worth_seeing'
        when 'stop_by'           then 'stop_by'
        else null
      end as m
      from unnest(p.tags) tg
    ) s
    where m is not null
  ),
  '{}'::text[]
)
where p.tags is not null and array_length(p.tags, 1) > 0;
