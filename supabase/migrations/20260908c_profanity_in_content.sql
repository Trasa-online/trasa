-- Cenzura tytulow list i wyjazdow (2026-09-08, zgloszenie z testow)
--
-- Nazwy uzytkownika juz filtrujemy (migracja 20260907b), ale ten sam problem wraca w kazdym
-- polu, ktore user wypelnia i ktore widza inni: publiczna lista moze sie nazywac
-- "najlepsze kurwy w Krakowie" i trafic na eksploracje.
--
-- Roznica wobec nazwy uzytkownika jest istotna. Nazwa to JEDEN wyraz bez spacji, wiec
-- porownywalismy ja w calosci. Tytul to zdanie, wiec slowa krotkie z listy 'exact'
-- ("sex", "ass", "anal") trzeba dopasowywac jako CALE WYRAZY - inaczej "Essex weekend",
-- "Cassandra poleca" i "Analityka miasta" wpadlyby na cenzure.

-- Postac do porownan dla ZDANIA: znaki spoza alfabetu staja sie spacja zamiast znikac,
-- wiec granice wyrazow przezywaja normalizacje. Musi dawac to samo, co
-- normalizeTextForMatch w src/lib/profanity.ts.
create or replace function public.normalize_text_for_match(v text, substitute boolean default true)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    case when substitute
      then translate(lower(coalesce(v, '')), 'ąćęłńóśźż' || '0134578@$!|(', 'acelnoszz' || 'oieastbasilc')
      else translate(lower(coalesce(v, '')), 'ąćęłńóśźż', 'acelnoszz')
    end,
    '[^a-z0-9]+', ' ', 'g'))
$$;

/**
 * Czy tresc zawiera wulgaryzm albo obelge z tabeli banned_usernames.
 * Trzy postacie napisu, kazda lapie inna sztuczke:
 *   1. z podmiana cyfr na litery       - "n4jlepsze kurwy",
 *   2. bez podmiany                    - "n1gg$er" (znak ROZDZIELA litery),
 *   3. bez znakow rozdzielajacych      - "k.u.r.w.y".
 * Wariant 3 tylko dla wzorcow 'substring': po sklejeniu wszystkiego nie ma granic wyrazow,
 * wiec krotkie slowa dawalyby falszywe alarmy.
 */
create or replace function public.contains_banned_words(v text)
returns boolean
language sql
stable
as $$
  with forms as (
    select public.normalize_text_for_match(v, true)  as n
    union all
    select public.normalize_text_for_match(v, false)
  )
  select exists (
    select 1 from forms f, public.banned_usernames b
     where (b.match_type = 'substring'
            and (position(b.pattern in f.n) > 0
                 or position(b.pattern in replace(f.n, ' ', '')) > 0))
        or (b.match_type = 'exact'
            and f.n ~ ('(^| )' || b.pattern || '( |$)'))
  )
$$;

-- Odmiana. Filtr chodzi po zdaniu, nie po jednym wyrazie, wiec musi znac formy.
insert into public.banned_usernames (pattern, match_type, note) values
  ('dupe','substring','odmiana'), ('dupy','substring','odmiana'),
  ('dupsko','substring','odmiana'), ('kurwe','substring','odmiana'),
  ('kurwie','substring','odmiana'), ('kurew','substring','odmiana')
on conflict (pattern) do nothing;

-- Wyzwalacz na tytuly. Opisu NIE blokujemy twardo - dluzszy tekst latwiej wpada na
-- falszywy alarm, a od tresci jest moderacja list publicznych.
create or replace function public.reject_banned_title()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.title is not distinct from old.title then
    return new;
  end if;
  if public.contains_banned_words(new.title) then
    raise exception 'title_not_allowed' using hint = 'tytul zawiera niedozwolone slowo';
  end if;
  return new;
end; $$;

drop trigger if exists trg_discovery_collections_title on public.discovery_collections;
create trigger trg_discovery_collections_title
  before insert or update of title on public.discovery_collections
  for each row execute function public.reject_banned_title();

drop trigger if exists trg_routes_title on public.routes;
create trigger trg_routes_title
  before insert or update of title on public.routes
  for each row execute function public.reject_banned_title();
