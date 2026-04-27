# CLAUDE.md — Trasa.travel

> Przeczytaj to przed każdą sesją. Są tu decyzje projektowe, brand guidelines i lista rzeczy których NIE ruszać.

---

## Czym jest Trasa

Trasa to aplikacja do planowania podróży grupowych. Użytkownicy przeglądają miejsca, dopasowują je wspólnie (nie nazywamy tego "swipe" ani "match" — zakazane słowa), tworzą trasy i prowadzą dziennik podróży. Firmy mogą dodać swój lokal jako wizytówkę i zarządzać wizerunkiem.

### Źródło danych miejsc (KRYTYCZNE)

Aplikacja pokazuje **wyłącznie miejsca z bazy Supabase** (tabela `places`). Nie ma żadnego trybu mock ani fallbacku do lokalnych danych.

- `src/lib/mockPlaces.ts` — **USUNIĘTY**, nie przywracać
- Jeśli miasto nie ma miejsc w DB → pokazujemy pusty stan, NIE generujemy fake danych
- `MOCK_MODE`, `getMockPlaces`, `MOCK_PLACE_DETAIL` — nie istnieją, nie używać

---

## Brand Guidelines

### Kolory

```
Primary (akcent):     gradient #F4A259 → #F9662B (orb, fill primary buttons)
Tło / biel:           #FEFEFE (złamana biel — NIE czyste #FFFFFF)
Typografia główna:    #0E0E0E (niemal-czarna)
Typografia secondary: #979797
Typografia tertiary:  #CFCFCF (niedostępne/placeholder)
```

W Tailwind odpowiedniki klas:
- Primary fill = `bg-orange-600` lub `bg-gradient-to-r from-[#F4A259] to-[#F9662B]`
- Primary stroke (secondary button) = `border-orange-600 text-orange-600 bg-white`
- Tekst główny = `text-foreground` (mapuje na #0E0E0E)
- Tekst secondary = `text-muted-foreground`

### ⛔ Zakaz ciemnych teł na stronach publicznych

**NIGDY nie używaj czarnego ani ciemnoszarego tła (`#0E0E0E`, `bg-slate-900`, `bg-black`, dark mode)** na stronach widocznych dla użytkowników (landing, waitlist, one-pager, itp.). Zawsze tło = `#FEFEFE` (złamana biel) lub bardzo jasny odcień (np. `bg-slate-50`). Ciemne tła są zarezerwowane wyłącznie dla nakładek wideo/overlay wewnątrz komponentów (np. phone mockup).

### Claim / tagline

Oficjalny tagline aplikacji: **"speed dating z miastem"** (wszystkie litery małe, bez kropek na końcu). Używaj go w headerach stron marketingowych. Nie zastępuj innymi sformułowaniami bez wyraźnej prośby.

### Typografia

- **Główna:** Inter (wszystkie wagi)
- **Akcenty nagłówkowe** (np. nagłówki sekcji w dzienniku, karty tras): Baloo, Regular
- NIE używaj innych fontów bez wyraźnej prośby

### Przyciski

- **Primary:** fill pomarańczowy (gradient), zaokrąglone — `rounded-2xl` lub `rounded-full`
- **Secondary:** białe tło + pomarańczowy stroke + pomarańczowy tekst
- **Destrukcyjne:** `bg-destructive` (czerwony), tylko dla nieodwracalnych akcji
- Wszystkie przyciski obłe, `rounded-2xl` minimum
- NIE używaj prostokątnych buttonów bez zaokrągleń

### Karty i sekcje

- Zaokrąglenia kart powinny być **komplementarne** do zaokrągleń przycisków (nie identyczne)
- Karty: `rounded-2xl` lub `rounded-3xl`
- Sekcje z podkładem: subtelne `bg-muted` lub `bg-background` z `border border-border/30`
- Cienie: subtelne, `shadow-sm` lub `shadow-md` — NIE ciężkie cienie

### Logo / Orb

- Logo Trasy = sama orba (gradient pomarańczowy, kula)
- **NIE** dodawaj białego tła do orby
- **NIE** dodawaj napisu "trasa" obok orby bez wyraźnej prośby
- CSS orby: `radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)`

---

## MVP Scope

### B2C (Użytkownicy)

1. **Wybieranie miejsc** — sesja grupowa, wybór miasta i kategorii
2. **Dopasowania** — miejsca wybrane przez wszystkich członków grupy
   - ⛔ ZAKAZ: słowa "swipe", "match" (jak w Tinder)
   - ✅ Używaj: "przeglądanie", "eksploracja", "dopasowania", "dodanie do trasy"
3. **Tworzenie trasy** — z wybranych/dopasowanych miejsc
4. **Podsumowanie podróży** — plan vs rzeczywistość, ocenianie miejsc przez grupę
5. **Dziennik** — zapisywanie "pocztówek" z trasy (Baloo font na nagłówkach kart)

### B2B (Firmy)

1. **Profil biznesowy** — wizytówka lokalu widoczna w trasach użytkowników
2. **Feed / wydarzenia** — aktualizacje, promocje (tylko pakiet Premium)
3. **Galeria zdjęć** — zarządzanie bazą zdjęć lokalu
4. **Analityka** — kliknięcia w szczegóły, dodania do trasy, oceny

---

## Architektura — czego NIE ruszać

### Google Places Proxy (KRYTYCZNE)

Cały pipeline zdjęć i danych miejsc musi przechodzić przez proxy. NIE fetchuj Google API bezpośrednio z klienta.

```
Klient → getPhotoUrl(ref) → /api/place-photo?ref=...&w=... → Google Places Photos API
                                       ↑ 1-rok CDN cache (Vercel Edge)

Klient → supabase.functions.invoke("google-places-proxy", ...) → Google Places API
                                       ↑ server-side, klucz bezpieczny
```

**Pliki proxy (NIE EDYTOWAĆ bez potrzeby):**
- `api/place-photo.ts` — Vercel Edge Function, proxy zdjęć z 1-rok cache
- `api/demo-places.ts` — Google Text Search dla demo, 24h cache
- `supabase/functions/google-places-proxy/` — główny server-side proxy
- `src/lib/placePhotos.ts` — `getPhotoUrl()` helper

**Zasady:**
1. `getPhotoUrl(photoReference)` → zawsze przez `/api/place-photo`
2. Filtr URL w komponentach musi akceptować zarówno `http://` jak i `/api/` prefiksy
3. `GOOGLE_MAPS_API_KEY` = tylko server-side (NIE VITE_ prefix)
4. Gdy `photo_url` w DB jest null → fallback do `/api/demo-places?city=...&category=...`
5. `skipGoogleFetch` prop w PlaceSwiperDetail/SwipeCard: używaj `false` dla fullscreen drawer (żeby były recenzje i zdjęcia Google), `true` tylko gdy zależy Ci na szybkości i masz własne zdjęcia
6. **Biznes z własnymi zdjęciami → blokuj Google Photos (KRYTYCZNE):** Gdy lokal ma choć jedno własne zdjęcie (cover image, cover video, lub galeria `gallery_urls`), NIE pobieraj zdjęć z Google Places. Pole `businessHasOwnPhoto: boolean` w `MockPlace` (ustawiane w `enrichWithBusinessProfile`) jest źródłem prawdy — `PlaceSwiperDetail` respektuje je automatycznie. Nie nadpisuj tego zachowania bez wyraźnego powodu.

### Supabase

- Klient: `src/integrations/supabase/client.ts`
- Typy: `src/integrations/supabase/types.ts` — regenerowane przez CLI, NIE edytuj ręcznie
- Migracje: `supabase/migrations/` — zawsze twórz nową migrację, NIE edytuj starych
- RLS: każda tabela musi mieć włączone Row Level Security

### Vercel Edge Functions

- Runtime: `export const config = { runtime: "edge" }`
- Lokalizacja: `api/` (root), NIE `src/api/`
- Sekretne zmienne: Vercel Dashboard → Environment Variables (bez VITE_ prefix)

---

## Znane problemy do naprawy

- [ ] `photo_url` w tabeli `places` jest null dla większości wpisów → potrzebne ręczne uzupełnienie lub skrypt migracyjny
- [x] Google Photos nie działa w `DemoSession` na etapie kart swipe — naprawione: `skipGoogleFetch=false` w DemoSwiper
- [x] Google Photos nie działa przy tworzeniu trasy — `skipGoogleFetch` domyślnie `false` w SwipeCard/PlaceSwiper
- [x] `PlaceDetailSheet` — sprawdzone, używa `getPhotoUrl()` poprawnie przez proxy

---

## Legacy / Do usunięcia

Poniższe elementy wyglądają na pozostałości po poprzednich pivotach:

**Strony:**
- `src/pages/Onboarding.tsx` — przekierowany do `/`, można usunąć
- `src/pages/SwipeHistory.tsx` — śledzi stare reakcje "swipe" z poprzedniego flow
- `src/pages/CreateRoute.tsx` — zastąpiony przez PlanWizard

**Komponenty:**
- `src/components/discover/` — stary flow odkrywania (SwipeCard, SwipeDiscovery)
  - ⚠️ Uwaga: `SwipeCard.tsx` w `discover/` vs `plan-wizard/PlaceSwiper.tsx` — sprawdź co jest aktualnie używane

**Zależności NPM (nieużywane):**
- `qrcode.react` — 0 użyć w kodzie
- `canvas-confetti` — 0 użyć w kodzie
- `recharts` (poza ikonką z lucide) — komponent chart.tsx istnieje ale nikt go nie importuje
- `embla-carousel-react` — carousel.tsx istnieje ale nie jest używany na stronach
- `react-resizable-panels` — resizable.tsx istnieje ale nie jest używany

---

## Konwencje kodowania

- **Język UI:** Polski (komunikaty, etykiety, placeholdery)
- **Język kodu:** Angielski (zmienne, funkcje, komentarze)
- **Styl komponentów:** Tailwind CSS, bez CSS Modules ani styled-components
- **Ikony:** Lucide React (`lucide-react`) — bez innych bibliotek ikon
- **Toast:** Sonner (`import { toast } from "sonner"`)
- **Formularze:** React Hook Form + Zod gdy złożone; prosty `useState` gdy 1-2 pola
- **Data fetching:** Supabase client direct lub `useQuery` z TanStack Query
- **Routing:** React Router v6, `useNavigate()` hook
- **Nie używaj:** `any` bez komentarza wyjaśniającego czemu; `console.log` bez prefiksu `[module-name]`

---

## Struktura repo

```
/
├── api/                    # Vercel Edge Functions (photo proxy, demo-places)
├── src/
│   ├── components/
│   │   ├── business/       # Komponenty dashboardu B2B
│   │   ├── home/           # Komponenty strony głównej (feed, karty tras)
│   │   ├── layout/         # AppLayout, BottomNav, OrbOverlay
│   │   ├── plan-wizard/    # Główny flow planowania (CityPicker → Swiper → Wyniki)
│   │   ├── route/          # Edytor trasy, timeline, chat AI
│   │   ├── social/         # Feed społecznościowy
│   │   └── ui/             # shadcn/ui primitives
│   ├── lib/
│   │   ├── placePhotos.ts  # getPhotoUrl() — CORE, nie ruszaj
│   │   ├── googleMaps.ts   # Geocoding utilities
│   │   └── mockPlaces.ts   # Mock data (używany jako fallback)
│   ├── pages/              # Route components (jeden plik = jedna strona)
│   └── integrations/supabase/  # Wygenerowane typy + klient
├── supabase/
│   ├── functions/          # Edge Functions (google-places-proxy, AI chat, etc.)
│   └── migrations/         # SQL migracje (NIE edytuj istniejących)
└── CLAUDE.md               # Ten plik
```
