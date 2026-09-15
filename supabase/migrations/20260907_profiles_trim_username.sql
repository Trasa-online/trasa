-- Nazwa uzytkownika ze spacja na koncu (2026-09-07)
--
-- "dagusiia " trafilo do bazy razem ze spacja (zapis z ekranu Ustawien szedl bez trim).
-- Profil publiczny szuka po DOKLADNEJ nazwie z adresu, wiec /profil/dagusiia nie trafialo
-- w zaden wiersz i konto bylo nieosiagalne. Klient juz trimuje wszedzie, ale to za malo:
-- kazda nowa sciezka zapisu (edge function, panel ops, skrypt) moglaby powtorzyc blad,
-- a UNIQUE na username daje sie obejsc jedna spacja - "berd" i "berd " to dla bazy dwie
-- rozne nazwy. Dlatego normalizacja siedzi w bazie, nie w kliencie.
--
-- Pusty napis po przycieciu traktujemy jako brak nazwy (NULL), zeby nie robic z "   "
-- poprawnego username.

create or replace function public.normalize_profile_names()
returns trigger
language plpgsql
as $$
begin
  new.username   := nullif(btrim(new.username), '');
  new.first_name := nullif(btrim(new.first_name), '');
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_names on public.profiles;
create trigger trg_profiles_normalize_names
  before insert or update of username, first_name on public.profiles
  for each row execute function public.normalize_profile_names();

-- Naprawa istniejacych danych. Robimy to WYLACZNIE tam, gdzie przyciecie nie tworzy duplikatu:
-- "berd " zderzylby sie z istniejacym "berd" (to dwa rozne konta), a o cudzej nazwie nie
-- decydujemy migracja - ten wiersz zostaje do recznej decyzji.
update public.profiles p
   set username = btrim(p.username)
 where p.username is not null
   and p.username <> btrim(p.username)
   and not exists (
     select 1 from public.profiles q
      where q.id <> p.id and q.username = btrim(p.username)
   );
