-- ODWIEDZINY WSZYSTKICH UCZESTNIKOW KOLEKCJI (zgloszenie testerki 2026-09-16:
-- "uczestnicy kolekcji tez moga odznaczyc, ze byli w danym miejscu").
--
-- Do tej pory widok kolekcji znal dwa stany: MOJE odwiedziny (`place_visits`, RLS wpuszcza
-- tylko wlasne wiersze) i odwiedziny AUTORA (`list_author_visits`). Wspoltworca mogl sobie
-- odhaczyc miejsce, ale nikt tego nie widzial, a na cudzej kolekcji przelacznika w ogole
-- nie bylo.
--
-- Ta funkcja oddaje pary (kto, miejsce) dla WLASCICIELA I WSZYSTKICH WSPOLTWORCOW jednej
-- kolekcji. SECURITY DEFINER, bo `place_visits` jest prywatne z definicji - i wlasnie
-- dlatego zakres jest tak waski: wylacznie miejsca Z TEJ kolekcji i wylacznie ludzie,
-- ktorzy ja wspoltworza. Nie da sie tym zapytac "gdzie byl user X".
--
-- Brama dostepu to `can_read_collection` - kto widzi kolekcje, widzi jej slady odwiedzin.
-- Prywatna "Ogolne" nie ma wspoltworcow, wiec zwroci co najwyzej wlasciciela (samego siebie).

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
     and v.place_key = case
           when coalesce(btrim(i.google_place_id), '') <> '' then 'gpid:' || i.google_place_id
           else 'nm:' || lower(btrim(coalesce(i.place_name, '')))
         end
$function$;

revoke execute on function public.list_collection_visits(uuid) from public, anon;
grant  execute on function public.list_collection_visits(uuid) to authenticated, anon;
