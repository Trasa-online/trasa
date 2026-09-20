-- ZNAJOMY = WZAJEMNA OBSERWACJA, z mozliwoscia JEDNOSTRONNEGO WYKLUCZENIA (decyzja Nat 2026-09-17).
--
-- Kontekst: 2026-07-26 przeszlismy z symetrycznego modelu 'friendships' (zaproszenie + akceptacja)
-- na asymetryczny 'followers' (jedno tapniecie, bez akceptacji). Stary model zostal w bazie i ma
-- dzis 4 wiersze; nowy ma 65 relacji, w tym 22 pary wzajemne. Spontaway ma byc reklamowany jako
-- siec oparta na znajomosciach, wiec "znajomi" wracaja jako POJECIE - ale nie jako druga relacja
-- do zawierania. Znajomy to po prostu ktos, kogo obserwujesz i kto obserwuje Ciebie.
--
-- Dlaczego NIE zaproszenie z akceptacja: w dniu wdrozenia znajomych byloby 4 pary zamiast 22,
-- wiec tresc "tylko dla znajomych" nie mialaby kogo ogladac; na cudzym profilu staly by DWA
-- guziki relacji (Obserwuj + Dodaj do znajomych); i bylby to powrot do modelu, ktory swiadomie
-- porzucilismy dwa miesiace temu.
--
-- ⚠️ DZIURA, ktora ten model ma z natury: odwzajemnienie obserwacji z grzecznosci daje komus
-- dostep do tresci prywatnej. Zatyka ja `friend_excludes`: mozesz kogos wypisac ze swoich
-- znajomych JEDNOSTRONNIE i po cichu, bez odobserwowania - bo odobserwowanie jest sygnalem
-- publicznym (znika z jego listy obserwujacych) i jest spolecznie kosztowne.

create table if not exists public.friend_excludes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  other_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, other_id),
  constraint friend_excludes_not_self check (user_id <> other_id)
);

alter table public.friend_excludes enable row level security;

-- Wylacznie wlasne wiersze - to jest prywatne ustawienie dostepu do tresci.
drop policy if exists "friend_excludes_own" on public.friend_excludes;
create policy "friend_excludes_own" on public.friend_excludes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists friend_excludes_other_idx on public.friend_excludes(other_id);

-- ── are_friends ────────────────────────────────────────────────────────────────
-- ⚠️ WYKLUCZENIE ZRYWA ZNAJOMOSC W OBIE STRONY. Nie dlatego, ze tak jest latwiej: nazwa mowi
-- "czy sa znajomymi", wiec funkcja musi byc symetryczna, inaczej ten sam kod bramkujacy tresc
-- dawalby rozne odpowiedzi zaleznie od tego, kto pyta. Skutek jest uczciwy: kto kogos wypisuje,
-- ten sam takze przestaje widziec jego tresc dla znajomych.
--
-- ⚠️ Sprawdzone na prodzie przed wdrozeniem: ZADNA polityka RLS nie uzywala dotad `are_friends`
-- (komentarz w migracji 20260726 mowil inaczej, ale polityki tras byly od tamtej pory pisane
-- na nowo). Redefinicja jest wiec bezpieczna, a od teraz funkcja NAPRAWDE bramkuje tresc.
create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select u1 is not null and u2 is not null and u1 <> u2
     and exists (select 1 from public.followers where follower_id = u1 and following_id = u2)
     and exists (select 1 from public.followers where follower_id = u2 and following_id = u1)
     and not exists (
       select 1 from public.friend_excludes e
       where (e.user_id = u1 and e.other_id = u2)
          or (e.user_id = u2 and e.other_id = u1)
     );
$$;

-- ── lista znajomych ────────────────────────────────────────────────────────────
-- ⚠️ Wykluczenia stosujemy WYLACZNIE do WLASNEJ listy. Tabela `followers` jest publiczna, wiec
-- wzajemne obserwacje kazdy moze policzyc sam. Gdyby cudza lista uwzgledniala wykluczenia,
-- wystarczyloby porownac ja z wlasnym wyliczeniem, zeby odczytac DOKLADNIE, kogo ta osoba
-- wypisala. Wykluczenie ma byc ciche - wiec publicznie relacja wyglada dalej na znajomosc,
-- a zmienia sie tylko to, co `are_friends` wpuszcza do tresci.
create or replace function public.friend_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select f1.following_id
  from public.followers f1
  join public.followers f2
    on f2.follower_id = f1.following_id
   and f2.following_id = f1.follower_id
  where f1.follower_id = p_user
    and (
      p_user is distinct from auth.uid()
      or not exists (
        select 1 from public.friend_excludes e
        where (e.user_id = p_user and e.other_id = f1.following_id)
           or (e.user_id = f1.following_id and e.other_id = p_user)
      )
    );
$$;

-- Regula z audytu: SECDEF dostaje EXECUTE dla PUBLIC z automatu, wiec odbieramy i nadajemy jawnie.
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.friend_ids(uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.friend_ids(uuid) to authenticated;
