-- Licznik "autor byl w X z N miejsc" na kafelkach list (Glowna + Eksploracja, prosba Nat
-- 2026-09-13, makieta: "8/15"). Zbiorczy odpowiednik list_author_visits (migracja 20260908i):
-- siatka ma 40 list naraz, a wolanie RPC per lista to 40 zapytan na jedno otwarcie ekranu.
--
-- Ta sama zasada prywatnosci: odwiedziny sa prywatne, wystawiamy WYLACZNIE liczbe dla
-- PUBLICZNEJ listy (albo wlasnej) - bez kluczy miejsc, bez list prywatnych innych osob.
-- Klucz miejsca liczony tak samo, jak placeKeyOf w src/lib/placePhotoSocial.ts.
create or replace function public.list_author_visit_counts(p_collection_ids uuid[])
returns table (collection_id uuid, visited integer)
language sql
security definer
stable
set search_path to 'public'
as $$
  select c.id as collection_id,
         count(distinct i.id)::int as visited
    from public.discovery_collections c
    join public.discovery_items i on i.collection_id = c.id
    join public.place_visits v
      on v.user_id = c.user_id
     and v.place_key = case
           when coalesce(btrim(i.google_place_id), '') <> '' then 'gpid:' || i.google_place_id
           else 'nm:' || lower(btrim(coalesce(i.place_name, '')))
         end
   where c.id = any(p_collection_ids)
     and (c.is_public or c.user_id = auth.uid())
   group by c.id
$$;

revoke execute on function public.list_author_visit_counts(uuid[]) from public;
grant execute on function public.list_author_visit_counts(uuid[]) to anon, authenticated;
