-- "Autor tu byl" na cudzej liscie (2026-09-08, prosba Nat)
--
-- Odwiedziny sa z zalozenia PRYWATNE (polityka "own visits readable": widzisz tylko swoje).
-- To zostaje - "gdzie ktos bywa" to wrazliwa informacja i nie ma powodu wystawiac jej
-- w calosci. Ale w JEDNYM kontekscie ta informacja jest sensem produktu: gdy ogladam czyjas
-- PUBLICZNA polecajke, chce wiedziec, czy autor faktycznie tam byl.
--
-- Dlatego nie rozszerzamy polityki SELECT (to odslonilby wszystkie odwiedziny kazdego), tylko
-- dajemy WASKIE okno: funkcja zwraca odwiedziny autora WYLACZNIE dla miejsc z tej jednej,
-- publicznej listy. Poza ta lista nadal nie widac niczego.
--
-- Klucz miejsca liczony tak samo, jak placeKeyOf w src/lib/placePhotoSocial.ts.
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
     -- Prywatna lista (np. "Ogolne") nie moze wyciekac nikomu poza wlascicielem.
     and (c.is_public or c.user_id = auth.uid())
     and v.place_key = case
           when coalesce(btrim(i.google_place_id), '') <> '' then 'gpid:' || i.google_place_id
           else 'nm:' || lower(btrim(coalesce(i.place_name, '')))
         end
$$;

revoke execute on function public.list_author_visits(uuid) from public;
grant execute on function public.list_author_visits(uuid) to anon, authenticated;

-- Bez tego funkcja skanuje place_visits per pozycja listy.
create index if not exists place_visits_key_idx on public.place_visits (place_key);
