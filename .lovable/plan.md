

## Problem

Feed wyswietla skeletony w nieskonczonosc, poniewaz zapytanie do `route_folders` zwraca blad HTTP 400:

```
"Could not find a relationship between 'route_folders' and 'user_id' in the schema cache"
```

Przyczyna: kolumna `route_folders.user_id` ma foreign key do `auth.users(id)`, ale kod uzywa joina `profiles:user_id(username, avatar_url)`. PostgREST nie moze wykonac tego joina, bo FK wskazuje na `auth.users`, a nie na `profiles`.

Tabela `routes` dziala poprawnie, bo jej `user_id` ma FK do `profiles(id)`.

## Rozwiazanie

### Krok 1: Migracja bazy danych

Dodac drugi foreign key z `route_folders.user_id` do `profiles(id)`. Dzieki temu PostgREST bedzie wiedzial jak joinowac `profiles` przez `user_id`.

```sql
ALTER TABLE public.route_folders
  ADD CONSTRAINT route_folders_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;
```

Istniejacy FK do `auth.users` moze zostac (nie koliduje). PostgREST uzyje hint `profiles:user_id` do wybrania wlasciwego FK.

### Krok 2: Brak zmian w kodzie

Kod w `Feed.tsx` juz poprawnie uzywa:
```typescript
profiles:user_id (username, avatar_url)
```

Po dodaniu FK migracja rozwiaze problem - zapytanie zacznie zwracac dane zamiast bledu 400.

## Wplyw

- Feed zacznie wyswietlac karty podrozy (TripFolderCard) i trasy (TripFeedCard) zamiast skeletonow
- Profil uzytkownika rowniez przestanie rzucac blad w TripFolderCard (widoczny w konsoli)
- Zadne istniejace dane nie zostana naruszone

## Sekcja techniczna

- Migracja: 1 polecenie ALTER TABLE (dodanie FK)
- Pliki do edycji: brak (kod juz jest poprawny)
- Ryzyko: niskie - dodajemy FK ktory mapuje te same UUID co istniejacy FK do auth.users

