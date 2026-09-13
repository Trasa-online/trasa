-- Gwiazdka ("topka") takze na LISTACH miejsc (prosba Nat 2026-09-13) - 1:1 z pins.is_top
-- (migracja 20260908f): autor listy wyroznia JEDNO miejsce warte polecenia. Limit pilnuje
-- klient (TOP_LIMIT w src/lib/topPlaces.ts), tak samo jak przy wyjazdach.
alter table public.discovery_items
  add column if not exists is_top boolean not null default false;

comment on column public.discovery_items.is_top is
  'Miejsce wyroznione gwiazdka przez autora listy ("topka"). Limit pilnuje klient.';

create index if not exists discovery_items_collection_top_idx on public.discovery_items (collection_id) where is_top;
