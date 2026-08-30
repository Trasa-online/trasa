-- Backfill miasta dla zapisanych miejsc (2026-08-30). Kolumna discovery_items.city powstala
-- 2026-08-28, wiec starsze zapisy jej nie maja - a od tej pory lista "Ogolne" ma filtr
-- kraj/miasto i te pozycje wypadaly z kazdego filtra.
-- Zrodlo: adres w formacie Google ("ulica, KOD MIASTO, Kraj") - bierzemy PRZEDOSTATNI segment
-- i obcinamy kod pocztowy. Adresy krotsze niz 3 segmenty pomijamy (ryzyko wziecia kraju za miasto).
with parts as (
  select id, string_to_array(address, ', ') as a
  from public.discovery_items
  where city is null and coalesce(address, '') <> ''
),
guess as (
  select id,
         case when array_length(a, 1) >= 3 then a[array_length(a, 1) - 1] else null end as raw
  from parts
)
update public.discovery_items i
set city = nullif(trim(regexp_replace(g.raw, '^[0-9][0-9A-Za-z\- ]{2,9}\s+', '')), '')
from guess g
where i.id = g.id
  and g.raw is not null
  and nullif(trim(regexp_replace(g.raw, '^[0-9][0-9A-Za-z\- ]{2,9}\s+', '')), '') is not null;
