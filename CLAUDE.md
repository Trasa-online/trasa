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
Akcent żółty (2026-08-12): #FDF184 (żółty) + #FDCD84 (złoty), gradient #FDF184 → #FDCD84
Tło / biel:           #FEFEFE (złamana biel — NIE czyste #FFFFFF)
Typografia główna:    #0E0E0E (niemal-czarna)
Typografia secondary: #979797
Typografia tertiary:  #CFCFCF (niedostępne/placeholder)
```

**Akcenty żółte (rebrand ikony 2026-08-12):** `#FDF184` i `#FDCD84` to kolory AKCENTOWE (z nowej ikony aplikacji, gradient żółty→złoty). **Pomarańczowy zostaje PRIMARY** - żółte to tylko akcenty (tła, wyróżnienia, dekoracje), NIE zastępują pomarańczu na guzikach primary. W Tailwind: `bg-trasa-yellow` (DEFAULT #FDF184) / `bg-trasa-gold` (#FDCD84), `text-trasa-yellow-ink` / `text-trasa-gold-ink`, gradient `bg-trasa-yellow` (util backgroundImage) lub `bg-gradient-to-r from-[#FDF184] to-[#FDCD84]`. Zakaz gradientu na guzikach dotyczy też żółtego.

W Tailwind odpowiedniki klas:
- Primary fill = `bg-orange-600` lub `bg-gradient-to-r from-[#F4A259] to-[#F9662B]`
- Secondary (guziki akcji) = **szary fill** `bg-secondary text-secondary-foreground` (styl YouTube), NIE biały+pomarańczowy stroke
- Tekst główny = `text-foreground` (mapuje na #0E0E0E)
- Tekst secondary = `text-muted-foreground`

### ⛔ Zakaz ciemnych teł na stronach publicznych

**NIGDY nie używaj czarnego ani ciemnoszarego tła (`#0E0E0E`, `bg-slate-900`, `bg-black`, dark mode)** na stronach widocznych dla użytkowników (landing, waitlist, one-pager, itp.). Zawsze tło = `#FEFEFE` (złamana biel) lub bardzo jasny odcień (np. `bg-slate-50`). Ciemne tła są zarezerwowane wyłącznie dla nakładek wideo/overlay wewnątrz komponentów (np. phone mockup).

### Identyfikacja B2B (panel biznesowy) - niebieski branding

**Cały kontekst dla firm = niebieska identyfikacja, NIE pomarańczowa.** Dotyczy wszystkich ekranów widocznych dla biznesowych użytkowników: panel logowania (`/auth?business=true`), Auth biznesowy, ustawianie hasła (`/set-password-biznes`), onboarding, banery powiadomień w `BusinessDashboard`, itp. Niebieski to **kolor akcentu** (guziki, toggle, badge, linki, focus) - nie tło.

**Layout ekranów auth B2B (2026-07-16, aktualny):** jasny, w stylu SaaS (referencja: aaply). Tło jasnoszare z kropkowanym wzorem, logo Trasy (pomarańczowe, w białym kółku) w lewym-górnym rogu + wordmark „trasa biznes", biała karta wycentrowana z formularzem, toggle „Zaloguj się / Zarejestruj lokal". Guzik szybkiego przełączenia w prawym-górnym rogu. **NIE** wracaj do ciemnego granatu (`bg-blue-950`) - to spójne z regułą „żadnych ciemnych teł na stronach publicznych". Reference: `Auth.tsx` (early-return `if (businessMode)`) i `SetPassword.tsx` (branch `isBusiness`).

**Paleta B2B (jasny layout):**
- Tło ekranu: `bg-[#F4F4F5]` + kropki `radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)` / `background-size: 22px 22px`
- Karta: `bg-white rounded-3xl shadow-xl shadow-slate-900/[0.06] border border-slate-100`
- Logo: `TrasaLogo` (pomarańczowe w białym kółku - patrz reguła Logo)
- Badge "Panel Biznesowy": `bg-blue-50 border-blue-100 text-blue-600`
- Inputs: `bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500`
- Labels: `text-slate-700`; tekst muted: `text-slate-500` / `text-slate-400`
- Toggle aktywny + Primary button: `bg-blue-600 hover:bg-blue-700 text-white`
- Linki / akcje secondary: `text-blue-600`

**Pomarańczowy (gradient `#F4A259 → #F9662B`) jest zarezerwowany WYŁĄCZNIE dla B2C** (użytkownicy końcowi: solo + grupowo). Wyjątek: samo **logo Trasy** zawsze pomarańczowe (w białym kółku), nawet w kontekście B2B. Poza logo nie mieszaj brandingu - akcent biznesowy = niebieski.

### Claim / tagline

Oficjalny tagline aplikacji: **"speed dating z miastem"** (wszystkie litery małe, bez kropek na końcu). Używaj go w headerach stron marketingowych. Nie zastępuj innymi sformułowaniami bez wyraźnej prośby.

### Typografia

- **Główna:** Inter (wszystkie wagi)
- **Akcenty nagłówkowe** (np. nagłówki sekcji w dzienniku, karty tras): Baloo, Regular
- NIE używaj innych fontów bez wyraźnej prośby

### Przyciski

- **Primary:** **SOLIDNY pomarańczowy fill** (`bg-orange-600` / `bg-primary`), zaokrąglenie **16px** (`rounded-2xl`). ⛔ **ZAKAZ gradientu na guzikach** (`linear-gradient(#F4A259 → #F9662B)` itp.) - domyślny guzik MUSI być jednolicie pomarańczowy. Gradientowy guzik tylko gdy Nat wyraźnie napisze, żeby go wprowadzić (decyzja 2026-08-04). Gradient zostaje wyłącznie dla logo/orba/akcentów tła, NIE dla guzików.
- **Secondary:** **szary fill** `bg-secondary text-secondary-foreground` (styl YouTube - jasny szary, ciemny tekst). NIE biały+pomarańczowy stroke. Dotyczy wszystkich guzików akcji secondary oraz komponentów "paper" (karty sugerujące klik, np. karty miejsc we wpisie dziennika = `bg-secondary`).
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

### Znak spontaway (rebrand 2026-08-04) - sam pomarańczowy symbol, BEZ kółka

**Marka: spontaway** (tylko logo/znak - nazewnictwo „trasa/trasy" w UI zostaje jako zwykłe słowo = route/routes). Znak = faliste „S" (plik `/spontaway-symbol.png`, pomarańczowy `#F75708` na przezroczystym tle).

- **Sam symbol, NIE w kółku.** Kolor przewodni pomarańcz, ale symbol nie jest już zamknięty w krążku (poprzednia reguła „znak zawsze w pomarańczowym kółku" = NIEAKTUALNA).
- **Używaj komponentu `TrasaLogo`** ([src/components/TrasaLogo.tsx](src/components/TrasaLogo.tsx)). Prop `size` = rozmiar boxu w px (symbol `object-contain`). Prop `tone`: `"orange"` (domyślnie, symbol pomarańczowy na jasnym tle) lub `"white"` (biały symbol na pomarańczu/ciemnym tle, np. loading/splash - przez filtr `brightness(0) invert(1)`).
- **Warianty kolorów wg tła:** jasne tło (`#FEFEFE`) → pomarańczowy symbol. Pomarańczowy kafelek (ikona aplikacji) → BIAŁY symbol.
- **Ikona aplikacji (home screen) + splash (rebrand 2026-08-12):** tło = **gradient żółto-złoty** (`#FDF184` → `#FDCD84`, diagonalny) + **POMARAŃCZOWY faliste „S"** (`#F75708`). Master ikony: `public/App icon IOS.png` (1024). **Splash 2732:** ten sam gradient + wyśrodkowane „S" (~38% szer.); `capacitor.config` splash `backgroundColor: '#FDDF84'` (mid gradientu). To ZASTĄPIŁO poprzednią regułę „białe tło + pomarańczowy symbol" (decyzja Nat - świadomie gradient na splash). **Avatar_Trasa** = pełna ikona (gradient + S). Rozmiary: AppIcon 1024, PWA `icon-192/512`, `apple-touch-icon` 180, `favicon` 48 - generowane `sips` z mastera; splash + avatar przez Pillow (gradient + `spontaway-symbol.png`).
- Wyjątek: **orba** (kula z gradientem) to osobny element - jej NIE ruszamy.
- **B2B branding + logo:** logo marki (pomarańczowy symbol) pojawia się nawet w niebieskim kontekście biznesowym (nagłówki auth, SetPassword, onboarding). Świadomy wyjątek od „B2B = tylko niebiesko".
- **Historia:** do 2026-08-04 znak = „T" w pomarańczowym kółku (wariant reverse, biały znak na gradiencie). Rebrand na spontaway: sam pomarańczowy symbol bez kółka.

---

## MVP Scope

### B2C (Użytkownicy)

1. **Wybieranie miejsc** — sesja solo lub grupowa, wybór miasta i kategorii
2. **Dopasowania** — miejsca wybrane przez użytkownika (solo) lub przez wszystkich członków grupy
   - ⛔ ZAKAZ: słowa "swipe", "match" (jak w Tinder)
   - ✅ Używaj: "przeglądanie", "eksploracja", "dopasowania", "dodanie do trasy"
3. **Tworzenie trasy** — z wybranych/dopasowanych miejsc
4. **Podsumowanie podróży** — plan vs rzeczywistość, **notki** o miejscach (solo lub przez grupę)
   - ⛔ **ZAKAZ ocen gwiazdkowych miejsc:** Użytkownik NIE wystawia żadnych ocen (gwiazdek/punktów) miejscom. Bazujemy WYŁĄCZNIE na wartościowych **notkach** userów. Nie dodawaj inputu oceny w podsumowaniu, dzienniku, wizytówce ani nigdzie indziej. (Gwiazdki Google na kartach to zewnętrzny rating do wyświetlania — to co innego, zostaje.)
5. **Wyjazdy** (dawny „Dziennik") — trasy usera z „pocztówkami"/wpisami (Baloo font na nagłówkach kart). Mieszkają w zakładce **Wyjazdy** na profilu (`/moj-profil`); osobny ekran `/dziennik` USUNIĘTY 2026-08-20 (patrz sekcja „Nawigacja i architektura informacji").

### B2B (Firmy)

1. **Profil biznesowy** — wizytówka lokalu widoczna w trasach użytkowników
2. **Feed / wydarzenia** — aktualizacje, promocje (tylko pakiet Premium)
3. **Galeria zdjęć** — zarządzanie bazą zdjęć lokalu
4. **Analityka** — kliknięcia w szczegóły, dodania do trasy, oceny

---

## Nawigacja i architektura informacji (IA) — aktualne (2026-08-20)

**BottomNav (native) = 3 pozycje:** `Eksploruj` · `+` (środkowy FAB) · `Profil`. Pasek to wąski, wyśrodkowany „pill" (HUG, nie full-width) z `px-4`; każdy target `w-16` (64px) × `h-14` — reguła „fat thumb". Plik: [src/components/layout/BottomNav.tsx](src/components/layout/BottomNav.tsx).
- **Eksploruj** → `/eksploruj` (tylko native; web/PWA to ukrywa, B2C za waitlistą).
- **`+` (FAB)** → na native `navigate("/utworz")` (drum-scroll kraj+miasto → forma tworzenia). Na web (stary flow) otwiera menu wyboru.
- **Profil** → `/moj-profil`.
- Web/PWA (stary flow, `!PLANNING_DISABLED`): slot 2 to `Wyjazdy` (`/home`) zamiast Eksploruj.

**Profil (`/moj-profil`, [TravelerProfile.tsx](src/pages/TravelerProfile.tsx)) = hub z 2 zakładkami** (`?tab=listy|wyjazdy`). **Zakładka „Zapisane" USUNIĘTA 2026-08-24** - zapisane miejsca żyją w LIŚCIE OGÓLNEJ (wishlista `to_visit`, patrz niżej), niewidocznej jako tab; pojawiają się przy tworzeniu listy/wyjazdu. Wewnątrz Listy i Wyjazdy są **podzakładki** (dropdown w stylu iOS, komponent lokalny `TabSelect`):
1. **Listy** — pigułki `[Moje listy | Zapisane]` (domyślnie **Moje listy**):
   - **Moje listy** — kuratorskie **publiczne polecajki** usera (`discovery_collections`, `kind='ranking'`, `list_status='visited'`). Grupy miejsc do polecenia, NIE luźne zapisy.
   - **Zapisane** — listy zapisane **od innych** userów. Komponent [SavedCollections](src/components/home/DiscoveryFeed.tsx) (localStorage `trasa_saved_collections`).
2. **Wyjazdy** (dawny Dziennik) — pigułki `[Robocze | Wspomnienia | Zapisane]` (domyślnie **Wspomnienia**):
   - **Robocze** — trasy usera `status != 'published'` (niepublikowane, badge „Robocze"). **Wspomnienia** — `status = 'published'`. Publikacja = „Zapisz trasę" (patrz model roboczy→przeszły). Karta renderowana wspólnym helperem `renderTripCard` (przekazuje `status/is_shared/trip_type` z zapytania `profile-trip-feed`).
   - **Zapisane** — trasy zapisane **od innych** userów (`saved_routes`). Komponent [SavedRoutes](src/components/home/DiscoveryFeed.tsx) z `city="all"`.
**Lista OGÓLNA (2026-08-24):** każde zapisane miejsce ląduje w prywatnej wishliście `to_visit` (per-miasto, `ensureToVisitList`/`quickSavePlace`). Drawer [SavePlaceSheet](src/components/plan-wizard/SavePlaceSheet.tsx) na „Zapisz" auto-zapisuje do ogólnej + pozwala **dodatkowo** dodać do istniejącej/nowej listy (`visited`). Lista ogólna NIE ma już zakładki na profilu - **pojawia się przy tworzeniu**: `fetchSavedPlaces` (płaska, wszystkie miasta) w [CreateFlowSheet](src/components/create/CreateFlowSheet.tsx) (lista, quick) i [CreateRanking](src/pages/CreateRanking.tsx) (lista, edytor); [ComposeWyjazd](src/pages/ComposeWyjazd.tsx) (wyjazd) pokazuje zapisane **dla miasta wyjazdu**. `SavedPlacesGrid` + `SavedListsRoutes` = martwy kod (pliki zostają).

**Profil publiczny (cudzy) — `/profil/:username`, [PublicProfile.tsx](src/pages/PublicProfile.tsx):** ten sam layout kart, ale **2 zakładki** (Listy · Wyjazdy), bez „Zapisane", tylko listy `visited`, **bez edycji/usuwania** (owner-only).

**⛔ USUNIĘTE ekrany (2026-08-20):** `/dziennik` (Journal) i `/polubione` (LikedPlaces) — cała treść przeniesiona do zakładek profilu. `Journal.tsx` + `LikedPlaces.tsx` usunięte. **Routy zostają jako `<Navigate>` redirecty** (stare deep-linki / pushe nie ubijają apki): `/dziennik` → `/moj-profil?tab=wyjazdy`, `/polubione` → `/moj-profil` (dawniej `?tab=zapisane`, zakładka usunięta 2026-08-24). Nowy kod nawiguj **wprost** na `/moj-profil?tab=…`, nie na `/dziennik`/`/polubione`. **`JournalTab` ZOSTAJE** (reused w [CreateDrafts](src/pages/CreateDrafts.tsx) „Robocze", route `/utworz/robocze`).

**Model prywatności list (patrz też memory `project_place_lists_model`):** zapis miejsca = **prywatna** lista „Do zobaczenia" (`list_status='to_visit'`, `is_public=false`). Świadoma **publiczna** polecajka = `list_status='visited'`, `is_public=true`. Bookmark ≠ polecenie.

**Polubienia + powiadomienia (2026-08-20):** tabele `likes` (trasy) i `collection_likes` (listy) + kolumny `likes_count`. Powiadomienia `route_liked` / `list_liked` (serce) i `list_saved` (bookmark) wstawiane triggerami **SECURITY DEFINER** (klient nie ma INSERT na `notifications`). Helpery: [src/lib/likes.ts](src/lib/likes.ts). Zapis cudzej trasy woła RPC `notify_route_used`, zapis listy `notify_collection_saved`.

**Zaproszenie do wyjazdu + push (2026-08-21):** zaproszenie do wspólnej trasy tworzy powiadomienie IN-APP typu `route_invite` (RPC `notify_route_invite`, host-only, dedup) - `inviteUsersToRoute` woła RPC zamiast klienckiego push (`sendGroupInvitePush` USUNIĘTY). **Jeden kanał push** = trigger `notify_push` na `notifications` → `net.http_post` (pg_net, schemat `net`, NIE `extensions.net`; `body` = jsonb) → `send-push`. **Uwierzytelnianie: nagłówek `x-trigger-secret` = sekret z Vault (`push_trigger_secret`), który `send-push` akceptuje jako wywołanie wewnętrzne (`isTrigger`).** NIE anon Bearer - `send-push` odrzuca anon (401, hardening [H2]); klucz service_role bywa rotowany. Sekret żyje w Vault (DB) + edge env `PUSH_TRIGGER_SECRET` (oba poza repo). Cały `http_post` + odczyt Vault w `EXCEPTION...NULL` (nigdy nie blokuje insertu notyfikacji). `notify_push` wysyła push dla: `group_invite`, `route_invite`, `friend_request`, `friend_accept`, `route_used`, `route_liked`, `list_liked`, `list_saved`. Dodając nowy typ powiadomienia z pushem: dopisz gałąź w `notify_push` (migracje `20260821_notif_push_route_invite.sql`, `20260827_notify_push_trigger_secret.sql`). Enum `notification_type` ADD VALUE aplikuj **osobno** przed użyciem (nie w tej samej transakcji).

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

Dwa konteksty, dwie proporcje:

- **Okładka swipe (SwipeCard / cover) = STRICT portret `9:16`** — kontener: `className="relative my-auto mx-auto w-full aspect-[9/16]"` + `style={{ maxWidth: "calc(100% - 2rem)", maxHeight: "min(680px, 100%)" }}`. Aspect-ratio CSS wymusza 9:16 niezależnie od device. `max-h: 100%` to parent-based (NIE `78dvh` viewport-based) - parent w `exploreMode` ma `pb-[calc(3rem+env(safe-area-inset-bottom,0px))]` chronace przed AppLayout fixed BottomNav (~94px). Bez tego card wystawala pod BottomNavem (ucinała się od dołu). Gdy max-height clampuje, browser shrinkuje width proporcjonalnie zachowując 9:16. `mx-auto` centruje horyzontalnie, `my-auto` wertikalnie w spare space. Sam obraz używa `object-cover` żeby kadrować do portretu niezależnie od formatu źródłowego.
- **Wewnątrz wizytówki (PlaceSwiperDetail - WSZYSTKIE zdjęcia) = `4:3` (pozioma).** Bottom-sheet otwierany po kliknięciu karty, drawer `h-[96dvh]` (prawie pełny ekran). Tailwind: `aspect-[4/3]`, `object-cover`. **Reguła sztywna:** Hero + Aktualności (posty) + galeria + każde inne zdjęcie w drawerze wizytówki MUSI mieć `aspect-[4/3]`. NIE używaj `aspect-square` ani innych proporcji dla zdjęć w wizytówce, nawet w grid 2-col. Wyjątek: fullscreen photo viewer (zoom) - tam `object-contain` bez aspect constraint.

**Auto-crop:** Jeżeli lokal wrzuci ze swojego profilu zdjęcie w innej proporcji, **NIE** wyświetlaj pełnego obrazka. Kontener z fixed aspect + `object-cover` na `<img>` automatycznie kadruje/centruje. Nie używaj `object-contain` na cover ani galerii — to psuje układ (czarne paski). `object-contain` dopuszczalny tylko w fullscreen photo viewer.

**Implementacja referencyjna:**
- [src/components/plan-wizard/PlaceSwiper.tsx](src/components/plan-wizard/PlaceSwiper.tsx) - kontener karty z `aspect-[9/16]` + max constraints
- [src/components/plan-wizard/PlaceSwiperDetail.tsx](src/components/plan-wizard/PlaceSwiperDetail.tsx) - SheetContent `h-[96dvh]`, hero `aspect-[4/3]`, Aktualności `aspect-[4/3]`, fullscreen viewer z `object-contain`

**Historia:**
- 2026-05-25: Wewnątrz wizytówki proporcja zmieniona z `16:9` na `4:3` żeby zdjęcia były większe (więcej powierzchni dla biz content), drawer wydłużony 92dvh→96dvh.
- 2026-05-26: Karta swipera przeszła z height-based (`flex: 1 1 0, maxHeight: min(680px, 78dvh)`) na strict `aspect-[9/16]` + max constraints. Wcześniejsze podejście dawało nieprawidłowy aspect na native iOS w standalone WebView (78dvh inne niż na web). Aspect-ratio + maxWidth/maxHeight rozwiązuje problem: browser shrinkuje width gdy height clampuje, utrzymując 9:16. Aktualności posts thumbnails: z `aspect-square` na `aspect-[4/3]` (reguła sztywna: WSZYSTKIE zdjęcia w wizytówce = 4:3).
- 2026-05-27: Karta w exploreMode (HomeSwipe) wystawała pod fixed BottomNavem (~94px) - ucinała się od dołu. Fix: PlaceSwiper root dostaje `pb-[calc(3rem+env(safe-area-inset-bottom,0px))]` w exploreMode (chronie przed BottomNav), card max-h zmieniona z `78dvh` (viewport-based, ignorowala BottomNav) na `min(680px, 100%)` (parent-based, wlicza pb). Plus `mb-4` zmienione na `my-auto` zeby card było wycentrowane wertikalnie w spare space. W PlanWizard mode (route /plan, BEZ BottomNav) `pb` nie jest stosowane.

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

**Personalizacja wizytówki biznesu (2026-07-01):** biznes może personalizować WYŁĄCZNIE **kolor guzika akcji "Dodaj"** (`color_button` / `businessColorButton`). Kategorie (badge), tło/overlay i promo są **jednolite w całej aplikacji** (nie personalizowane). Kolumny `color_badge`/`color_card_bg` zostają w DB ale są ignorowane w UI. Nie przywracaj ich stosowania bez wyraźnej prośby.

---

### ⛔ PlaceSwiper — sizing karty 9:16 ZAMROŻONY (src/components/plan-wizard/PlaceSwiper.tsx)

**NIE zmieniaj sizingu, paddingu ani pozycji karty bez wyraźnej prośby użytkownika.** Layout został długo dobierany i działa na wszystkich rozmiarach iPhone'a (SE → 15 Pro Max) zarówno w HomeSwipe (`exploreMode`) jak i solo PlanWizard (`/plan`).

**Co jest zamrożone:**
- Karta: `aspect-[9/16]` strict + height-first sizing (width liczone z dostępnej wysokości, NIE odwrotnie)
- Width formula: `min(420px, calc(100vw - 48px), calc((100dvh - env(top) - [env(bottom)] - 200px) * 9 / 16))`
- Chrome subtraction: exploreMode 200px, solo 242px (solo ma dodatkowy tab bar 42px "Eksploruj | Dopasowania" w PlanWizard step 4)
- exploreMode: bez env(bottom) (BottomNav pb-safe absorbuje). Solo: z env(bottom) (CTA pb-safe-4 dodaje osobno)
- Wrapper: `flex-1 min-h-0 flex items-start justify-center w-full pt-2` (items-start, NIE items-center - karta przylega do gory zamiast byc centrowana)
- Root PlaceSwiper: `flex flex-col flex-1 min-h-0` BEZ explicit pb (chrome subtraction w dvh calc zalatwia bezpieczenstwo)
- NIE uzywac `maxHeight: 100%` lub `maxHeight: 100dvh - X` na karcie (parent-relative % zawodzi w iOS Capacitor WebView z flex-1 ancestrami)

**Historia rozwiazania:**
- 2026-05-28: Reset z parent-relative `maxHeight: 100%` (zawodzilo na iOS) na explicit dvh-based calc + height-first sizing zeby 9:16 ratio bylo strict niezaleznie od ekranu.

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
- **⛔ ZAKAZ EMOJI w UI:** Nigdy nie dodawaj emoji (🍽️ ☕ 🌳 🏰 📍 itp.) do żadnego elementu interfejsu: placeholderów zdjęć/miniaturek, badge'ów kategorii, kart, list, etykiet, komunikatów, pustych stanów. Zamiast emoji kategorii używaj **ikon SVG** (`public/Ikona__*.svg` przez helper `categoryIconSrc()` z `src/lib/placeCategoryIcon.ts`) na peachy tle `#fcede3` (fallback zdjęcia miejsca = `PlacePhoto`). Dotyczy to nowych i istniejących widoków. Wyjątek: emoji w flagach/oznaczeniach czysto tekstowych bez alternatywy (np. 🇵🇱 w tej dokumentacji) - ale w UI aplikacji NIE.
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
