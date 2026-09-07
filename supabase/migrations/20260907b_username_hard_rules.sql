-- Podszywanie sie pod cudze konto przez nazwe uzytkownika (2026-09-07)
--
-- Tester zmienil sobie nazwe na "berd " i przeszedl obok istniejacego admina "berd".
-- Dwa niezalezne bledy zlozyly sie na jedno:
--   1. ekran Ustawien w ogole nie sprawdzal dostepnosci (i nie pokazywal bledu zapisu),
--   2. UNIQUE na profiles.username porownuje BAJT W BAJT - "berd ", "Berd" i "BERD" to
--      dla bazy trzy rozne nazwy, wiec nawet poprawny klient niczego by nie zatrzymal.
--
-- Walidacja w kliencie jest wygoda, nie zabezpieczeniem: kazdy z dostepem do anon key moze
-- uderzyc w PostgREST bezposrednio. Dlatego reguly stoja tutaj.

-- ── 1. Unikalnosc BEZ WZGLEDU na wielkosc liter ──────────────────────────────
-- Spacje na brzegach przycina juz wyzwalacz z migracji 20260907, wiec indeks wystarczy
-- oprzec na lower(). Nazwy z jedna spacja w srodku (konta biznesowe) zostaja nietkniete.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ── 2. Wulgaryzmy, obelgi i nazwy zastrzezone ────────────────────────────────
-- Lista mieszka w tabeli, nie w kodzie funkcji: dopisanie slowa to jeden INSERT, bez
-- migracji i bez wdrozenia apki. Klient ma swoja kopie (src/lib/usernameRules.ts) tylko
-- po to, zeby pokazac blad od razu przy pisaniu.
create table if not exists public.banned_usernames (
  pattern text primary key,
  -- 'substring' = slowo nie moze wystapic NIGDZIE w nazwie (wulgaryzmy jednoznaczne),
  -- 'exact'     = blokujemy tylko nazwe rowna slowu (krotkie i takie, ktore siedza
  --               w niewinnych nickach: "Cassandra", "Dickinson", "analityk").
  match_type text not null default 'substring' check (match_type in ('substring', 'exact')),
  note text
);
alter table public.banned_usernames enable row level security;
-- Czytac moze kazdy zalogowany (podpowiedz w formularzu), pisac nikt poza service_role.
drop policy if exists "banned usernames readable" on public.banned_usernames;
create policy "banned usernames readable" on public.banned_usernames for select using (true);

insert into public.banned_usernames (pattern, match_type, note) values
  -- angielski
  ('nigger','substring','obelga rasowa'), ('nigga','substring','obelga rasowa'),
  ('faggot','substring','obelga'), ('cunt','substring','wulgaryzm'),
  ('motherfuck','substring','wulgaryzm'), ('fuck','substring','wulgaryzm'),
  ('whore','substring','obelga'), ('slut','substring','obelga'),
  ('bitch','substring','obelga'), ('pussy','substring','wulgaryzm'),
  ('rapist','substring','przestepstwo'), ('pedophile','substring','przestepstwo'),
  ('porn','substring','tresc dla doroslych'), ('hitler','substring','nazizm'),
  ('holocaust','substring','nazizm'),
  ('ass','exact','czlon niewinnych nazw - Cassandra'), ('fag','exact','obelga'),
  ('dick','exact','czlon nazwisk - Dickinson'), ('cock','exact','czlon nazw - Hancock'),
  ('anal','exact','czlon slowa analityk'), ('sex','exact','tresc dla doroslych'),
  ('shit','exact','wulgaryzm'), ('nazi','exact','nazizm'), ('rape','exact','przestepstwo'),
  ('retard','exact','obelga'),
  -- polski
  ('kurwa','substring','wulgaryzm'), ('kurwy','substring','wulgaryzm'),
  ('jebac','substring','wulgaryzm'), ('jeban','substring','wulgaryzm'),
  ('jebie','substring','wulgaryzm'), ('pierdol','substring','wulgaryzm'),
  ('pierdal','substring','wulgaryzm'), ('spierdal','substring','wulgaryzm'),
  ('wypierdal','substring','wulgaryzm'), ('chuj','substring','wulgaryzm'),
  ('chuja','substring','wulgaryzm'), ('chuje','substring','wulgaryzm'),
  ('pizda','substring','wulgaryzm'), ('pizdy','substring','wulgaryzm'),
  ('skurwysyn','substring','obelga'), ('cwel','substring','obelga'),
  ('kutas','substring','wulgaryzm'), ('dupa','substring','wulgaryzm'),
  ('murzyn','substring','obelga rasowa'), ('ciota','substring','obelga'),
  ('pedal','substring','obelga'), ('debil','substring','obelga'),
  ('kretyn','substring','obelga'), ('zjeb','substring','obelga'),
  ('pojeb','substring','obelga'), ('gowno','substring','wulgaryzm'),
  ('szmata','substring','obelga'),
  ('suka','exact','takze samica psa'), ('cipa','exact','wulgaryzm'),
  ('huj','exact','wulgaryzm'), ('sperma','exact','wulgaryzm'),
  ('penis','exact','wulgaryzm'), ('wagina','exact','wulgaryzm'),
  -- nazwy zastrzezone: chodzi o podszywanie sie pod nas i pod obsluge
  ('admin','exact','rola'), ('administrator','exact','rola'), ('moderator','exact','rola'),
  ('mod','exact','rola'), ('support','exact','rola'), ('pomoc','exact','rola'),
  ('help','exact','rola'), ('official','exact','rola'), ('oficjalne','exact','rola'),
  ('system','exact','rola'), ('root','exact','rola'), ('staff','exact','rola'),
  ('team','exact','rola'), ('kontakt','exact','rola'), ('contact','exact','rola'),
  ('info','exact','rola'), ('obsluga','exact','rola'), ('security','exact','rola')
on conflict (pattern) do nothing;

-- Postac do POROWNAN: male litery, bez polskich ogonkow, bez podmianek "leet" (n1gger,
-- ch@j) i bez znakow rozdzielajacych (n.i.g.g.e.r). Musi dawac to samo, co
-- normalizeForMatch w src/lib/usernameRules.ts.
create or replace function public.normalize_username_for_match(v text, substitute boolean default true)
returns text
language sql
immutable
as $$
  -- Dwa warianty, bo te same znaki sluza do dwoch roznych sztuczek:
  --   substitute = true  -> "n1gg3r" (cyfra UDAJE litere) staje sie "nigger",
  --   substitute = false -> "n1gg$er" (znak ROZDZIELA litery) staje sie "nigger".
  -- Jeden wariant nie lapie drugiego, wiec wyzwalacz sprawdza oba.
  select regexp_replace(
    case when substitute
      then translate(lower(coalesce(v, '')), 'ąćęłńóśźż' || '0134578@$!|(', 'acelnoszz' || 'oieastbasilc')
      else translate(lower(coalesce(v, '')), 'ąćęłńóśźż', 'acelnoszz')
    end,
    '[^a-z0-9]', '', 'g')
$$;

create or replace function public.reject_banned_username()
returns trigger
language plpgsql
as $$
declare
  n  text := public.normalize_username_for_match(new.username, true);
  n2 text := public.normalize_username_for_match(new.username, false);
begin
  -- Przy edycji innych pol nazwa sie nie zmienia - nie ma czego sprawdzac. Dzieki temu
  -- istniejace konta z historycznymi nazwami dzialaja dalej.
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;
  if n = '' then
    raise exception 'username_not_allowed' using hint = 'nazwa musi zawierac litery lub cyfry';
  end if;
  if new.username !~ '^[[:alnum:]._-]+( [[:alnum:]._-]+)*$' or char_length(new.username) > 20 then
    raise exception 'username_not_allowed' using hint = 'dozwolone: litery, cyfry, . _ - (max 20 znakow)';
  end if;
  if exists (
    select 1 from public.banned_usernames b
     where (b.match_type = 'exact' and b.pattern in (n, n2))
        or (b.match_type = 'substring' and (position(b.pattern in n) > 0 or position(b.pattern in n2) > 0))
  ) then
    raise exception 'username_not_allowed' using hint = 'nazwa zawiera niedozwolone slowo';
  end if;
  return new;
end;
$$;

-- Bez klauzuli WHEN: przy INSERT nie ma OLD, wiec warunek "czy nazwa sie zmienila"
-- sprawdza sama funkcja.
drop trigger if exists trg_profiles_reject_banned_username on public.profiles;
create trigger trg_profiles_reject_banned_username
  before insert or update of username on public.profiles
  for each row execute function public.reject_banned_username();

-- ── 3. Dozwolone znaki i niewidzialne sztuczki ───────────────────────────────
-- Test pokazal, ze samo filtrowanie slow nie wystarcza: "n1gg$er" przechodzilo, bo znak
-- rozdzielal litery. Zamiast gonic kolejne warianty, zawezamy alfabet - litery (takze
-- polskie), cyfry, kropka, podkreslenie, myslnik i POJEDYNCZA spacja w srodku (maja ja
-- historyczne konta lokali: "Orest Coffee & Vintage" traci tylko ampersand).
--
-- Osobno znaki NIEWIDZIALNE. To najgrozniejszy wariant podszywania sie: "berd" ze spacja
-- nielamiaca albo ze znakiem zerowej szerokosci wyglada na ekranie DOKLADNIE tak samo jak
-- "berd", a btrim() ich nie rusza, bo to nie jest zwykla spacja.
create or replace function public.normalize_profile_names()
returns trigger
language plpgsql
as $$
declare
  u text := new.username;
begin
  if u is not null then
    -- znaki zerowej szerokosci i znacznik kolejnosci pisma: kasujemy bez sladu
    u := regexp_replace(u, '[\u200b\u200c\u200d\u2060\ufeff]', '', 'g');
    -- spacje "nietypowe" (nielamiaca, wlosowa, firetowa...) sprowadzamy do zwyklej
    u := translate(u, e'\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000', '                ');
    u := btrim(regexp_replace(u, ' +', ' ', 'g'));
  end if;
  new.username   := nullif(u, '');
  new.first_name := nullif(btrim(new.first_name), '');
  return new;
end;
$$;
