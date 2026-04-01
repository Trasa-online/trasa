

## Analiza i sugestie

### Znalezione problemy

1. **`super_liked` nie zapisuje się w bazie** — tabela `user_place_reactions` ma CHECK constraint `reaction IN ('liked', 'skipped')`, ale kod wysyła `'super_liked'`. Upsert po cichu failuje.

2. **Brak akcji kończącej** — jedyny sposób to: (a) przejrzeć wszystkie karty do końca, (b) kliknąć mały link "X wybranych · Zaplanuj trasę" na dole. Nie ma przycisku "Zakończ odkrywanie" ani podsumowania.

3. **Wcześniej polajkowane miejsca nie są filtrowane** — jeśli user wraca do eksploracji tego samego miasta, zobaczy znowu miejsca które już ocenił.

### Proponowane zmiany

#### 1. Naprawić CHECK constraint (migracja)
Dodać `'super_liked'` do dozwolonych wartości w `user_place_reactions.reaction`.

#### 2. Dodać widoczny przycisk "Zakończ" / podsumowanie
- W dolnym pasku akcji (obok guzików skip/like), gdy `likedPlaces.length >= 3`, pokazać wyraźny przycisk "Zaplanuj trasę" zamiast małego tekstu.
- Alternatywnie: sticky footer z licznikiem wybranych i CTA.

#### 3. Filtrować wcześniej ocenione miejsca
- Przy ładowaniu `places`, pobrać też `user_place_reactions` usera dla danego miasta.
- Odfiltrować z kolejki miejsca, które user już ocenił (chyba że wraca z explicit stanem).

#### 4. Opcja "Zakończ bez planowania"
- Dodać guzik "Zakończ" w headerze, który zapisuje reakcje i wraca do `/discover` (SwipeHistory) — user może wrócić do planowania później.

### Szczegóły techniczne

**Migracja:**
```sql
ALTER TABLE public.user_place_reactions
  DROP CONSTRAINT user_place_reactions_reaction_check;
ALTER TABLE public.user_place_reactions
  ADD CONSTRAINT user_place_reactions_reaction_check
  CHECK (reaction IN ('liked', 'skipped', 'super_liked'));
```

**PlaceSwiper.tsx:**
- W `useEffect` ładującym `places`, dodać zapytanie do `user_place_reactions` i wykluczyć już ocenione `place_id`.
- Zamienić mały link "X wybranych · Zaplanuj trasę" na widoczny sticky CTA gdy `likedCount >= 1`.
- Dodać przycisk "Zakończ" w headerze nawigujący do `/discover`.

**Pliki do edycji:**
- Nowa migracja SQL (1 plik)
- `src/components/plan-wizard/PlaceSwiper.tsx` — filtrowanie + UI kończące

