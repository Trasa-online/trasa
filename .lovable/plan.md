

## Problem

Feed nie wyswietla zadnych tras, poniewaz query `feed-folders` zwraca blad **400** z Supabase:

```
Could not find a relationship between 'route_folders' and 'user_id'
```

Tabela `route_folders` nie ma zadnych kluczy obcych (foreign keys). Bez nich PostgREST nie moze wykonac joina `profiles:user_id(...)` ani poprawnie joinowac `routes`. Query `feedFolders` nigdy sie nie rozwiazuje (zwraca `undefined`), wiec `feedItems` tez jest `undefined`, i feed pokazuje loading skeletons w nieskonczonosc.

## Rozwiazanie

### Krok 1: Dodaj brakujace klucze obce do `route_folders`

Migracja SQL:

```sql
-- FK: route_folders.user_id -> profiles.id
ALTER TABLE public.route_folders
  ADD CONSTRAINT route_folders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

Tabela `routes` prawdopodobnie juz ma FK na `folder_id -> route_folders.id` (sprawdze). Jesli nie, tez trzeba dodac:

```sql
ALTER TABLE public.routes
  ADD CONSTRAINT routes_folder_id_fkey
  FOREIGN KEY (folder_id) REFERENCES public.route_folders(id) ON SET NULL;
```

### Krok 2: Weryfikacja

Po dodaniu FK, query `profiles:user_id(username, avatar_url)` w Feed.tsx i Profile.tsx zacznie dzialac poprawnie. Feed powinien wyswietlic zarowno foldery jak i samodzielne trasy.

### Wplyw

- **Feed.tsx** - query `feed-folders` zacznie dzialac, karty sie pokaza
- **Profile.tsx** - query `user-folders` z joinem na `routes` bedzie dzialac poprawnie  
- Zadne zmiany w kodzie frontendu nie sa wymagane - problem jest wylacznie po stronie bazy danych

