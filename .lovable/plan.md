

# Nowy flow planowania trasy oparty na czacie AI

## Podsumowanie zmian

Aplikacja przechodzi z modelu "user recznie dodaje piny, potem AI analizuje" na model "user opisuje co chce, AI generuje plan z prawdziwymi miejscami". Zmienia sie rowniez strona glowna -- z feedu spolecznosciowego na profil z aktywnymi trasami.

## Architektura nowego flow

```text
[Home /] --> [Zaplanuj swoja podroz] --> [Step 1: Preferencje] --> [Step 2: Chat + edycja planu] --> [Summary dialog] --> [Home z aktywna trasa]
```

---

## 1. Nowa strona glowna (Home)

**Plik:** `src/pages/Home.tsx` (nowy, zastepuje Feed na route `/`)

**Zawartosc:**
- Avatar + nazwa uzytkownika (z tabeli `profiles`)
- Sekcja "Aktywna podroz" -- karta z miastem, datami, liczbą pinow (pobierana z `routes` gdzie `status = 'draft'` lub nowy status `active`)
- Sekcja "Twoje wczesniejsze trasy" -- lista opublikowanych tras
- Przycisk CTA na dole: "Zaplanuj swoja podroz" --> nawiguje do `/create`
- Empty state gdy brak aktywnych tras

**Zmiany w routingu (`App.tsx`):**
- `/` --> `Home` (zamiast `Feed`)
- Feed przeniesiony na `/feed` lub usuniety (do decyzji)

---

## 2. Nowy kreator tras -- Step 1: Preferencje

**Plik:** `src/pages/CreateRoute.tsx` (przebudowany)

**Formularz preferencji:**
- **Ile dni** -- przyciski 1/2/3 (pill selector)
- **Tempo dnia** -- Aktywna / Spokojna / Mixed
- **Priorytety** -- multi-select pills: good food, nice views, long walks (mozliwosc dodania wlasnych)
- **Data** -- date picker (wplywa na plan -- sezonowosc, eventy)
- **Tryb planowania** -- Rozmowa (voice) / Tekst
- Przycisk "Dalej" --> przechodzi do Step 2

**Dane zapisywane do stanu lokalnego** (nie do DB na tym etapie):
```typescript
interface TripPreferences {
  numDays: 1 | 2 | 3;
  pace: "active" | "calm" | "mixed";
  priorities: string[];
  startDate: Date | null;
  planningMode: "voice" | "text";
}
```

---

## 3. Nowy kreator tras -- Step 2: Chat + edycja planu

**Plik:** `src/components/route/PlanChatExperience.tsx` (nowy komponent)

**Layout (pelny ekran):**
- **Gora:** wiadomosci czatu (babelki AI i usera)
- **Srodek:** gdy AI wygeneruje plan -- edytowalna lista pinow pogrupowana per dzien:
  - Naglowek "Dzien #1 z N"
  - Piny z: drag handle, nazwa, krotki opis, pole czasu (00:00), przycisk usun
  - Mapa z numerowanymi markerami
  - Licznik edycji: "Ilosc zmian" + "Pozostalo 2/3"
- **Dol:** input tekstowy + przycisk mikrofonu + przycisk wyslij
- **FAB (prawy dol):** przycisk potwierdzenia (checkmark) --> otwiera Summary

**Logika czatu:**
1. AI otrzymuje preferencje z Step 1
2. AI zadaje 1-2 dodatkowych pytan (np. "Czy masz juz jakies plan na te podroz?")
3. AI generuje plan z prawdziwymi miejscami (Google Places API)
4. Plan wyswietla sie w UI jako edytowalny
5. User moze wprowadzic max 3 poprawki per dzien (glosem lub tekstem, albo recznie)
6. Po kazdej poprawce AI aktualizuje plan

---

## 4. Nowa Edge Function: `plan-route`

**Plik:** `supabase/functions/plan-route/index.ts`

**Roznice vs obecny `chat-route`:**
- `chat-route` = analiza ISTNIEJACYCH pinow (post-trip review)
- `plan-route` = GENEROWANIE nowych pinow na podstawie preferencji (pre-trip planning)

**System prompt -- kluczowe elementy:**

```text
Jestes planistą podróży w aplikacji TRASA.
User chce zaplanowac podroz. Masz jego preferencje:
- Miasto/region: [z rozmowy]
- Liczba dni: {numDays}
- Tempo: {pace}
- Priorytety: {priorities}
- Data: {startDate}

## FAZY ROZMOWY (max 3 wymiany przed generowaniem planu)

### Faza 1 -- DESTYNACJA + KONTEKST
Zapytaj dokad jedzie i czy ma juz jakies plany (nocleg, konkretne miejsca).
Wyciagnij: city, country, existing_plans[]

### Faza 2 -- DOPRECYZOWANIE
Na podstawie priorytetow i odpowiedzi dopytaj o szczegoly.
Np. jaki typ kuchni, czy chce muzea, jak daleko od centrum.

### Faza 3 -- GENEROWANIE PLANU
Wygeneruj plan dnia/dni z prawdziwymi miejscami.
Kazde miejsce musi zawierac:
- place_name (prawdziwa nazwa)
- address (pelny adres)
- description (1 zdanie dlaczego)
- suggested_time (proponowana godzina)
- category (restaurant/cafe/museum/park/viewpoint/shopping/nightlife)
- day_number (ktory dzien)

## EDYCJA PLANU
Gdy user prosi o zmiane:
- "Zamien X na cos innego" --> zaproponuj alternatywe
- "Dodaj Y" --> wstaw w optymalne miejsce
- "Usun Z" --> usun i zaproponuj zamiennik
- Max 3 edycje per dzien

## FORMAT ODPOWIEDZI Z PLANEM
Gdy generujesz lub aktualizujesz plan, dodaj blok:
<route_plan>
{
  "city": "Warszawa",
  "days": [
    {
      "day_number": 1,
      "pins": [
        {
          "place_name": "Zamek Krolewski",
          "address": "plac Zamkowy 4, Warszawa",
          "description": "Zabytkowa rezydencja krolewska",
          "suggested_time": "10:00",
          "category": "museum",
          "latitude": 52.2479,
          "longitude": 21.0147
        }
      ]
    }
  ]
}
</route_plan>
```

**Google Places integration:**
- Edge function uzywa Google Places API (Text Search) do weryfikacji i wzbogacenia miejsc o koordynaty, place_id
- Klucz API: ten sam `AIzaSyCdZ-on1_mKr1Q9OTDYkqkk4OzB7SwR32M` (juz jest w kodzie)
- Alternatywnie: AI generuje nazwy, a frontend resolve'uje je przez istniejacy `AddressAutocomplete`

---

## 5. Summary Dialog

**Plik:** `src/components/route/RouteSummaryDialog.tsx` (nowy)

**Zawartosc (modal/dialog):**
- Tytul: "Twoja trasa {daty}"
- Mapa z numerowanymi markerami
- Lista pinow pogrupowana per dzien (timeline z kropkami i linia laczaca)
- Kazdy pin: nazwa, krotki opis, godzina
- Przycisk "Dodaj trase" --> zapisuje do DB i wraca na Home

**Zapis do bazy:**
- Tworzy `route` (lub `route_folder` dla multi-day) z `status: 'active'`
- Tworzy `pins` z koordynatami z Google Places
- Aktualizuje `chat_sessions` z historia rozmowy

---

## 6. Zmiany w bazie danych (migracja)

```sql
-- Nowe kolumny w routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS pace text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS priorities text[] DEFAULT '{}';

-- Nowe kolumny w pins
ALTER TABLE pins ADD COLUMN IF NOT EXISTS suggested_time text;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS category text;
```

---

## 7. Zmiany w nawigacji

- **BottomNav:** przycisk "+" otwiera bezposrednio `/create` (zamiast CreateModeDrawer)
- **Home CTA:** "Zaplanuj swoja podroz" --> `/create`
- **Routing:** `/` = Home, `/feed` = Feed (opcjonalnie)

---

## 8. Voice input (tryb Rozmowa)

Wykorzystuje istniejacy `webkitSpeechRecognition` z `ChatExperience.tsx`:
- Jezyk: `pl-PL`
- Transkrypcja w czasie rzeczywistym
- Po zakonczeniu mowienia -- automatyczne wyslanie wiadomosci

---

## Kolejnosc implementacji

1. Migracja DB (nowe kolumny)
2. Edge Function `plan-route` z nowym promptem
3. Komponent `PlanChatExperience` (chat + edytowalny plan)
4. Komponent `RouteSummaryDialog` (podsumowanie)
5. Przebudowa `CreateRoute.tsx` (Step 1 preferencje + Step 2 chat)
6. Nowa strona `Home.tsx`
7. Aktualizacja routingu i nawigacji

---

## Sekcja techniczna

### Struktura plikow (nowe/zmienione)

```text
src/pages/Home.tsx                          -- nowy
src/pages/CreateRoute.tsx                   -- przebudowany
src/components/route/PlanChatExperience.tsx  -- nowy
src/components/route/RouteSummaryDialog.tsx  -- nowy
src/components/route/DayPinList.tsx          -- nowy (edytowalna lista pinow per dzien)
supabase/functions/plan-route/index.ts      -- nowy
src/App.tsx                                 -- zmieniony routing
src/components/layout/BottomNav.tsx          -- uproszczony
```

### Edge Function `plan-route` -- architektura

- Endpoint przyjmuje: `{ preferences, messages, current_plan? }`
- Jesli `current_plan` istnieje, AI dostaje go jako kontekst do edycji
- AI odpowiada tekstem + opcjonalnie blokiem `<route_plan>...</route_plan>`
- Frontend parsuje blok i renderuje edytowalny plan
- Google Places API wywolywane w edge function do weryfikacji koordynatow

### Istniejacy `chat-route` -- co z nim?

Zostaje bez zmian jako osobny flow do analizy post-trip (po zakonczeniu podrozy). Nowy `plan-route` sluzy do planowania PRZED podroza.

