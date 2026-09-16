-- "WYROZNIONE" NA WIZYTOWCE PREMIUM (prosba Nat 2026-09-16): ile osob wyroznilo ten lokal
-- gwiazdka "topki".
--
-- Gwiazdka zyje w DWOCH miejscach: `pins.is_top` (wyjazdy) i `discovery_items.is_top`
-- (kolekcje) - tak samo, jak liczy je licznik na profilu (`starredPlaces.ts`). Tozsamosc
-- miejsca to ZNORMALIZOWANA NAZWA (`place_note_key`), ta sama regula co przy notkach
-- i zdjeciach miejsc.
--
-- ⚠️ Liczymy OSOBY, nie wiersze. Kto wyroznil ten sam lokal w trzech kolekcjach, liczy sie
-- raz - inaczej jedna osoba robilaby lokalowi "spoleczny dowod" w pojedynke.
--
-- ⛔ Liczymy WYLACZNIE tresc PUBLICZNA: wyjazdy opublikowane i kolekcje publiczne
-- (niezaakceptowane i ukryte przez admina odpadaja). Gwiazdka w prywatnym szkicu jest
-- prywatna - samo jej doliczenie do publicznego licznika zdradzaloby, ze ktos gdzies ma ten
-- lokal u siebie. Konsekwencja do zapamietania: licznik na wizytowce bywa MNIEJSZY niz suma
-- gwiazdek widoczna wlascicielom na ich profilach i to jest poprawne.
--
-- SECURITY DEFINER, bo RLS nie pozwoliloby zwyklemu userowi policzyc cudzych wierszy;
-- funkcja oddaje SAMA LICZBE, bez zadnych tozsamosci.

create or replace function public.place_star_count(p_name text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  with k as (select public.place_note_key(p_name) as key)
  select count(*)::int from (
    select distinct r.user_id
      from public.pins pn
      join public.routes r on r.id = pn.route_id
     where pn.is_top is true
       and r.deleted_at is null
       and r.status = 'published'
       and r.user_id is not null
       and public.place_note_key(pn.place_name) = (select key from k)
       and (select key from k) <> ''
    union
    select distinct c.user_id
      from public.discovery_items di
      join public.discovery_collections c on c.id = di.collection_id
     where di.is_top is true
       and c.deleted_at is null
       and c.is_public
       and coalesce(c.hidden_by_admin, false) = false
       and c.moderation_status <> 'rejected'
       and c.user_id is not null
       and public.place_note_key(di.place_name) = (select key from k)
       and (select key from k) <> ''
  ) osoby;
$function$;

revoke execute on function public.place_star_count(text) from public;
grant  execute on function public.place_star_count(text) to authenticated, anon;
