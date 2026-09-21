-- ODWIEDZINY IDA ZA MIEJSCEM NIEZALEZNIE OD KLUCZA (zgloszenie Nat 2026-09-21: „jesli user doda
-- miejsce, ktore juz odwiedzil, do innej kolekcji, tez niech bedzie odhaczone").
--
-- Odwiedziny zawsze byly per MIEJSCE (nie per kolekcja), ale to samo miejsce ma w dwoch
-- kolekcjach rozne klucze: pozycja z wyszukiwarki Google ma `google_place_id` (klucz
-- `gpid:...`), pozycja dodana z planu albo recznie - nie (klucz `nm:nazwa`). Odhaczenie
-- zapisane pod jednym kluczem nie pasowalo do pozycji z drugim, wiec w nowej kolekcji
-- miejsce wygladalo na nieodwiedzone. Od teraz dopasowujemy po OBU kluczach - tak samo,
-- jak `pinCoverKeys` przy zdjeciach miejsca.
--
-- Funkcje zwracaja klucz w postaci, POD KTORA odwiedziny sa zapisane; klient mapuje go na
-- pozycje po obu kandydatach (SharedList: `visitMatchesItem`).

create or replace function public.item_visit_keys(p_google_place_id text, p_place_name text)
returns text[]
language sql
immutable
as $$
  select array_remove(array[
    case when coalesce(btrim(p_google_place_id), '') <> '' then 'gpid:' || btrim(p_google_place_id) end,
    'nm:' || lower(btrim(coalesce(p_place_name, '')))
  ], null);
$$;

create or replace function public.list_author_visits(p_collection_id uuid)
returns table (place_key text)
language sql
security definer
stable
set search_path to 'public'
as $$
  select distinct v.place_key
    from public.discovery_collections c
    join public.discovery_items i on i.collection_id = c.id
    join public.place_visits v on v.user_id = c.user_id
   where c.id = p_collection_id
     and (c.is_public or c.user_id = auth.uid())
     and v.place_key = any(public.item_visit_keys(i.google_place_id, i.place_name))
$$;
revoke execute on function public.list_author_visits(uuid) from public;
grant execute on function public.list_author_visits(uuid) to anon, authenticated;

create or replace function public.list_collection_visits(p_collection_id uuid)
returns table(user_id uuid, place_key text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with people as (
    select c.user_id from public.discovery_collections c
     where c.id = p_collection_id and c.user_id is not null
    union
    select m.user_id from public.discovery_collection_members m
     where m.collection_id = p_collection_id
  )
  select distinct v.user_id, v.place_key
    from public.discovery_items i
    join public.place_visits v on v.user_id in (select people.user_id from people)
   where i.collection_id = p_collection_id
     and public.can_read_collection(p_collection_id, auth.uid())
     and v.place_key = any(public.item_visit_keys(i.google_place_id, i.place_name))
$function$;

create or replace function public.list_author_visit_counts(p_collection_ids uuid[])
returns table(collection_id uuid, visited integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id as collection_id,
         count(distinct i.id)::int as visited
    from public.discovery_collections c
    join public.discovery_items i on i.collection_id = c.id
    join public.place_visits v
      on v.user_id = c.user_id
     and v.place_key = any(public.item_visit_keys(i.google_place_id, i.place_name))
   where c.id = any(p_collection_ids)
     and (c.is_public or c.user_id = auth.uid())
   group by c.id
$function$;
