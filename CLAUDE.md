# CLAUDE.md — Trasa.travel

> Przeczytaj to przed każdą sesją. Są tu decyzje projektowe, brand guidelines i lista rzeczy których NIE ruszać.

---

## Czym jest Trasa

Trasa to aplikacja do planowania podróży - zarówno **grupowo**, jak i **solo**. Użytkownicy przeglądają miejsca, dopasowują je (samodzielnie lub wspólnie z grupą - ale nie nazywamy tego "swipe" ani "match", to zakazane słowa), tworzą trasy i prowadzą dziennik podróży. Tryb grupowy jest jednym z kluczowych use case'ów, ale nie wyklucza solo tripów - cały flow działa też dla pojedynczego użytkownika. Firmy mogą dodać swój lokal jako wizytówkę i zarządzać wizerunkiem.

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

### Identyfikacja B2B (panel biznesowy) - niebieski branding

**Cały kontekst dla firm = niebieska identyfikacja, NIE pomarańczowa.** Dotyczy wszystkich ekranów widocznych dla biznesowych użytkowników: panel logowania (`/auth?business=true`), draft upgrade (`/auth?draft=...`), Auth biznesowy, banery powiadomień w `BusinessDashboard`, itp.

**Paleta B2B:**
- Tło ekranu: `bg-blue-950` (granatowe)
- Orb (logo): `radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 60%, #1d4ed8)`
- Badge "Panel Biznesowy": `bg-blue-500/20 border-blue-400/30 text-blue-300`
- Inputs: `bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus:ring-blue-500`
- Labels: `text-blue-200`
- Tekst muted: `text-blue-300/70`
- Primary button: `bg-blue-600 hover:bg-blue-700 text-white`
- Linki / akcje secondary: `text-blue-400` lub `text-blue-300/70`

**Pomarańczowy (gradient `#F4A259 → #F9662B`) jest zarezerwowany WYŁĄCZNIE dla B2C** (użytkownicy końcowi: solo + grupowo). Nigdy nie mieszaj brandingu - jeśli ekran jest częścią flow zakładania/zarządzania wizytówką firmy, używaj niebieskiej palety. Reference: `Auth.tsx` (sekcje `businessMode` i `isDraftMode`).

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

1. **Wybieranie miejsc** — sesja solo lub grupowa, wybór miasta i kategorii
2. **Dopasowania** — miejsca wybrane przez użytkownika (solo) lub przez wszystkich członków grupy
   - ⛔ ZAKAZ: słowa "swipe", "match" (jak w Tinder)
   - ✅ Używaj: "przeglądanie", "eksploracja", "dopasowania", "dodanie do trasy"
3. **Tworzenie trasy** — z wybranych/dopasowanych miejsc
4. **Podsumowanie podróży** — plan vs rzeczywistość, ocenianie miejsc (solo lub przez grupę)
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

### Proporcje zdjęć wizytówek (KRYTYCZNE)

Dwa konteksty, dwie proporcje — niezmienne:

- **Okładka swipe (SwipeCard / cover) = portret, kierunek `9:16`.** Karta swipe'owalna na HomeSwipe/PlanWizard wypełnia dostępną wysokość ekranu (flex 1, maxHeight 78dvh), więc realna proporcja zmienia się z urządzeniem. NIE wymuszaj `aspect-[9/16]` na kontenerze — testowaliśmy, na mobile Safari to robi kartę za małą (banner + filter chip + bottom nav zjadają dużo, kontener z fixed aspect kurczy się do nieczytelnego rozmiaru). Sam **obraz** używa `object-cover` żeby kadrować do portretu niezależnie od formatu źródłowego.
- **Wewnątrz wizytówki (PlaceSwiperDetail hero + Aktualności + galeria) = `16:9` (pozioma).** Bottom-sheet otwierany po kliknięciu karty, sekcja Aktualności z postami biznesu. Tailwind: `aspect-[16/9]`, `object-cover`.

**Auto-crop:** Jeżeli lokal wrzuci ze swojego profilu zdjęcie w innej proporcji, **NIE** wyświetlaj pełnego obrazka. Kontener z fixed aspect + `object-cover` na `<img>` automatycznie kadruje/centruje. Nie używaj `object-contain` na cover ani galerii — to psuje układ (czarne paski). `object-contain` dopuszczalny tylko w fullscreen photo viewer.

**Implementacja referencyjna:**
- [src/components/plan-wizard/PlaceSwiper.tsx](src/components/plan-wizard/PlaceSwiper.tsx) - kontener karty z `aspect-[9/16]` + `maxHeight: min(680px, 78dvh)`
- [src/components/plan-wizard/PlaceSwiperDetail.tsx](src/components/plan-wizard/PlaceSwiperDetail.tsx) - hero `aspect-[16/9]`, Aktualności `aspect-[16/9]`, fullscreen viewer z `object-contain`

### Supabase

- Klient: `src/integrations/supabase/client.ts`
- Typy: `src/integrations/supabase/types.ts` — regenerowane przez CLI, NIE edytuj ręcznie
- Migracje: `supabase/migrations/` — zawsze twórz nową migrację, NIE edytuj starych
- RLS: każda tabela musi mieć włączone Row Level Security

### Vercel Edge Functions

- Runtime: `export const config = { runtime: "edge" }`
- Lokalizacja: `api/` (root), NIE `src/api/`
- Sekretne zmienne: Vercel Dashboard → Environment Variables (bez VITE_ prefix)

### ⛔ ForBusinessPage — ZAMROŻONA, nie ruszać (src/pages/ForBusinessPage.tsx)

**NIE edytuj tego pliku.** Strona `/dla-firm` jest zachowana do późniejszego wykorzystania. Nie przepisuj, nie refaktoruj, nie usuwaj. Nowy one-pager dla firm to osobny plik `src/pages/BusinessLanding.tsx` pod routem `/dla-firm/landing`.

---

### ⛔ BusinessDashboard — główny dashboard firm ZAMROŻONY (src/pages/BusinessDashboard.tsx)

**NIE wprowadzaj żadnych zmian** w głównym dashboardzie biznesowym (`/biznes/:id`) bez wyraźnej zgody użytkownika. Dotyczy to zarówno layoutu, logiki, jak i stylów. Każda zmiana wymaga explicit "możesz zmienić X w dashboardzie".

---

### ⛔ WaitlistPage — układ i animacja ZAMROŻONE (src/pages/WaitlistPage.tsx)

**NIE zmieniaj układu, z-indeksów ani logiki animacji.** Układ jest zatwierdzony i wymaga długiego debugowania — każda zmiana może go zepsuć.

**Co jest zamrożone:**
- Układ mobile: `"speed dating"` (shrink-0, z-5/60) → orba (w-14, z-50) → telefon (flex-1 min-h-0) → `"z miastem"` (shrink-0 mt-2, z-5/60)
- Outer container: `height: 100dvh` — NIE zmieniać na minHeight
- Sekcja content: `flex-1 min-h-0` — NIE dodawać overflow-hidden ani zmieniać flex
- `FullscreenIntroVideo`: `position: fixed`, `overflow: hidden`, `zIndex: 40` → rośnie do `60` przy shrink
- Animacja przejścia: spring shrink (stiffness 120, damping 20) do rect ekranu telefonu (inset 9px, borderRadius 34px), potem fade 0.25s
- `PhoneMockup` (compact): **width-based** sizing (`width: 60vw, maxWidth: 265px, aspectRatio: 9/19.5`) — NIE używaj height-based dvh (nie działa w Safari flex context)
- `phoneBodyRef` → przekazywany do `FullscreenIntroVideo` i `PhoneMockup ref=` — NIE usuwać
- `shrinking` state → podnosi telefon z z-1 do z-50 przy starcie animacji (żeby bezel był widoczny)
- `onShrinkStart` callback → dwa rAF frames przed startem spring (żeby React zdążył odmalować)

**Co MOŻNA zmieniać:**
- Pliki wideo wewnątrz mockupu telefonu (`src` w `PhaseA`, `PhaseE` itp.)
- Plik intro video (`/founders_intro.mp4` → `src` w `FullscreenIntroVideo`)
- Treść faz (tekst, karty demo w `PhaseB`, `PhaseC`, `PhaseE`)
- Sekcja bottom CTA (email capture, badges, link do `/dla-firm`)
- Desktop layout (`hidden lg:flex` — osobna sekcja, niezależna od mobile)

### DemoSession TopBar - zasady (src/pages/DemoSession.tsx)

**Wszystkie kroki musza miec identyczna wysokosc headera** (padding `pt-safe-4 pb-3`, jeden wiersz tekstu, brak subtitles).

- Swipe header: `text-sm` dla nazwy miasta, brak subtitle/numeracji rundy, brak awatarow, brak ikony wyszukiwania, brak ikony dodania uczestnika
- Badge "dla firm ->" (niebieski, `rounded-full`) renderuje sie TYLKO gdy `isBiznesDemo === true`
- `isBiznesDemo = searchParams.get("biznes") === "1"` - ustawiany z URL param
- Route `/biznes/demo` przekierowuje do `/demo?biznes=1` (w App.tsx)
- Biznes demo: drum scroll z TYLKO Warszawa (odblokowana), reszta miast zablokowana

---

## Dual-platform conventions (iOS native vs Web/PWA)

Trasa działa równolegle jako natywna aplikacja iOS (Capacitor 8, WebView) i web/PWA (Vercel). Jeden codebase, dwa cele wdrożenia. Niektóre zachowania powinny się różnić - poniżej obowiązujący wzorzec.

### Detection — zawsze przez `src/lib/platform.ts`

```ts
import { isNative, isWeb, platform, capabilities } from "@/lib/platform";
```

- `isNative` — `true` dla iOS/Android Capacitor WebView
- `isWeb` — `true` dla zwykłej przeglądarki (web + PWA)
- `platform` — `"ios" | "android" | "web"` (raw)
- `capabilities.*` — jawne flagi: `webShare`, `nativeShare`, `haptics`, `pushNotifications`, `serviceWorker`, `installablePWA`, `vercelAnalytics`

**NIE używaj `Capacitor.isNativePlatform()` bezpośrednio w kodzie.** Jedyne miejsce z tym importem to `platform.ts`. Wszędzie indziej importuj nazwane flagi.

### Inline branching — preferowany wzorzec

Małe różnice UI/UX trzymamy `{isNative ? A : B}` w komponencie, **w jednym pliku**. Bez konwencji `.native.tsx` / `.web.tsx`.

```tsx
{isNative ? "Wróć" : "← Wróć do strony głównej"}
```

### Native APIs przez capability hooki w `src/hooks/`

Każde wywołanie natywnego API ma swój hook który decyduje co użyć:

- [src/hooks/useShare.ts](src/hooks/useShare.ts) — Capacitor Share na native, `navigator.share` lub clipboard na web
- [src/hooks/useHaptics.ts](src/hooks/useHaptics.ts) — Capacitor Haptics na native, no-op na web

Wywołanie z komponentu nie wie nic o platformie:

```tsx
const share = useShare();
const result = await share({ title, url });
// result.method: "native" | "webshare" | "clipboard"
```

Kolejne native features (push, camera, biometric) dodajemy w tym samym wzorcu: nowy hook w `src/hooks/use*.ts` z fallbackiem.

### Native-only / Web-only kod

```ts
if (isNative) { /* ten kod wykonuje się tylko w iOS/Android */ }
if (isWeb) { /* ten kod wykonuje się tylko w przeglądarce */ }
```

Vite tree-shaking nie eliminuje tych branchy statycznie (`isNative` to runtime stała), ale runtime guard wystarcza i jest jasny dla developera.

### Workflow przed git push

1. `npm run check:both` — buduje dist + robi `cap sync ios`. Musi przejść bez błędów.
2. Sprawdź w przeglądarce na `localhost:8080` (jeśli ruszałaś UI)
3. Cmd+R w Xcode w simulatorze (jeśli ruszałaś UI)

Jeśli zmiana dotyczy obu platform, przetestuj na obu **zanim** wypchniesz.

### Anti-patterns (NIE rób)

- ❌ Osobne pliki `.native.tsx` / `.web.tsx` (zdecydowaliśmy: inline branching)
- ❌ User-agent sniffing (`navigator.userAgent.match(...)`)
- ❌ Sprawdzanie `window.cordova` lub innych proxy hacków
- ❌ Hardcoded `if (window.location.hostname === ...)` w logice biznesowej
- ❌ Osobne build flagi per platforma (`--mode ios`) — mamy jeden build, jeden `dist/`
- ❌ Duplikowanie komponentów żeby zrobić "wersję na iOS" — zawsze inline if-em

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
- **Ikony:** Lucide React (`lucide-react`) - bez innych bibliotek ikon
- **⛔ ZAKAZ długich myślników (—, em dash):** Nigdy nie używaj znaku `—` w żadnym tekście UI (banery, hinty, placeholdery, etykiety, komunikaty). Zamiast tego używaj zwykłego myślnika `-`, dwukropka `:`, przecinka lub przeformułuj zdanie.
- **🇵🇱 Polskie sieroty (typography rule, OBOWIĄZKOWE):** Pojedyncze litery `a, i, o, u, w, z` (oraz krótkie `do, na, po, za, ze, od` jeśli to możliwe) NIGDY nie mogą kończyć linii. Po nich zawsze musi być **twarda spacja** (non-breaking space, ` ` / NBSP / U+00A0), żeby przeniosły się do następnej linii razem z kolejnym słowem.
  - **Dotyczy:** wszystkie teksty UI w aplikacji i na stronach marketingowych (nagłówki, opisy, etykiety, placeholdery, treści maili, modale, toasty).
  - **W JSX:** używaj template literal z escape, np. `` {`treść z przyjaciółmi i grupą`} ``, albo inline `{" "}` w miejscach z elementami HTML w środku.
  - **Jak rozpoznać:** czytaj zdanie i znajduj pojedyncze litery przed spacją - tam wstaw NBSP. Przykład: `"z miastem"` → `"z miastem"`, `"i wam"` → `"i wam"`.
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
