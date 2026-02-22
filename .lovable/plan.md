

## Inline Check-in na stronie glownej + AI-powered DayReview

### Co robimy

Dwie zmiany:

1. **Inline checklist pod aktywna trasa** -- zamiast oddzielnej strony `/day-checkin`, lista miejsc z checkboxami pojawi sie bezposrednio na stronie glownej pod karta aktywnej podrozy (gdy dzien podrozy juz trwa). User odhacza/odznacza miejsca i klika "Dalej", co zapisuje `was_skipped` i otwiera DayReview.

2. **AI-powered DayReview** -- zamiast statycznej puli pytan, DayReview uzyje edge function `chat-route` (Gemini), ktora juz istnieje i potrafi prowadzic naturalna rozmowe. System prompt zostanie rozszerzony o kontekst pomini ietych miejsc (`was_skipped`), aby AI moglo celnie dopytac "Dlaczego pominales X? Co zrobiles zamiast tego?".

---

### Szczegoly implementacji

#### 1. Nowy komponent `TripCheckinSection`

Nowy plik: `src/components/home/TripCheckinSection.tsx`

- Przyjmuje props: `routeId`, `pins[]`, `city`, `onComplete`
- Renderuje liste pinow z checkboxami (logika z obecnego `DayCheckin`)
- Przycisk "Dalej -- opowiedz o dniu" zapisuje `was_skipped` do DB i wywoluje `onComplete(routeId)`
- Komponent jest kompaktowy, bez naglowka -- renderowany inline

#### 2. Zmiany w `Home.tsx`

- Dla kazdej aktywnej podrozy, gdzie dzisiejszy dzien >= `startDate` i `chat_status !== "completed"`, wyswietl `TripCheckinSection` bezposrednio pod karta podrozy
- Po klikni eciu "Dalej" nawigacja do `/day-review?route=<id>`
- Usunac `dayReviewModal` (AlertDialog) -- zastapiony inline checkin sekcja
- Usunac zolty plywajacy przycisk "Jak Twoj dzien?" -- nie jest juz potrzebny

#### 3. Zmiany w `DayReview.tsx` -- AI chat zamiast statycznych pytan

- Usunac `BASE_QUESTIONS` i lokalna logike pytaniowa
- Dodac wywolanie `chat-route` edge function (fetch do Supabase)
- Flow:
  1. User widzi timeline + pytanie poczatkowe "Jak minal Twoj dzien?"
  2. User odpowiada tekstem (lub voice)
  3. Kazda odpowiedz jest wysylana do `chat-route` z pelna historia wiadomosci
  4. AI odpowiada kontekstowo, odwolujac sie do konkretnych pinow i pomini etych miejsc
  5. Gdy AI zwroci `done: true`, czat sie konczy i wyswietla podsumowanie
- Usunac poczatkowe przyciski "Tak/Nie" -- AI samo prowadzi rozmowe

#### 4. Zmiany w `chat-route/index.ts` -- kontekst skipped pins

- Rozszerzyc query o pola: `was_skipped`, `skip_reason`, `category`, `suggested_time`
- Dodac do `pinsContext` informacje o pomini etych miejscach, np.:
  ```
  3. Ramen People (Karmelicka 5) [POMINIETY]
  ```
- Dodac do system prompt instrukcje:
  ```
  Jesli user pominol jakies miejsca (oznaczone [POMINIETY]),
  zapytaj dlaczego -- moze cos lepszego znalazl, moze nie mial czasu.
  Bądź ciekawy, nie oceniaj.
  ```

#### 5. Cleanup

- Strona `/day-checkin` i jej route w `App.tsx` moga zostac usuni ete (cala logika przeniesiona do inline komponentu)
- Plik `src/pages/DayCheckin.tsx` do usuniecia

---

### Techniczne detale

```text
Flow uzytkownika:

Home (/)
  |
  +-- Karta aktywnej podrozy "Krakow"
  |     [klik -> RoutePreviewModal]
  |
  +-- TripCheckinSection (inline)
  |     [ ] 1. Rynek Glowny      10:00
  |     [x] 2. Sukiennice        11:00  (odznaczony = pominiety)
  |     [ ] 3. Ramen People      13:30
  |     [Dalej -- opowiedz o dniu]
  |           |
  |           v  (saves was_skipped, navigates)
  |
  DayReview (/day-review?route=xxx)
        AI: "Czesc! Widzę że dzisiaj miales
             zaplanowane 7 miejsc, a pominales
             Sukiennice. Opowiedz -- jak minal dzien?"
        User: "Bylo super, ale..."
        AI: (kontekstowe follow-up)
        ...
        AI: "Dzieki! Zapisalem." + <route_summary>
```

### Pliki do zmiany

| Plik | Akcja |
|------|-------|
| `src/components/home/TripCheckinSection.tsx` | Nowy komponent |
| `src/pages/Home.tsx` | Dodac inline checkin, usunac dayReviewModal |
| `src/pages/DayReview.tsx` | Zamienic statyczne pytania na AI chat via `chat-route` |
| `supabase/functions/chat-route/index.ts` | Rozszerzyc o kontekst skipped pins |
| `src/pages/DayCheckin.tsx` | Usunac |
| `src/App.tsx` | Usunac route `/day-checkin` |

