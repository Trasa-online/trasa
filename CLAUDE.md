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
- Primary fill = **`bg-primary`** (= `#EE5307`). ⛔ NIE `bg-orange-600` - patrz reguła jednego pomarańczu niżej.
- Secondary (guziki akcji) = **szary fill** `bg-secondary text-secondary-foreground` (styl YouTube), NIE biały+pomarańczowy stroke
- Tekst główny = `text-foreground` (mapuje na #0E0E0E)
- Tekst secondary = `text-muted-foreground`

**Paleta landingu spontaway (2026-09-02).** Marketingowa strona B2C pod `spontaway.com`
(route `/`, [SpontawayLanding.tsx](src/pages/SpontawayLanding.tsx)) ma własną, węższą
paletę z Figmy („Landing B2C ... high-fi copy"), w Tailwindzie jako `spontaway.*`:

```
Primary (marka):   #EE5307  bg-spontaway-orange   (znak, guziki, duże nagłówki)
Secondary (tło):   #FDF184  bg-spontaway-yellow   (karty hero/CTA, pasek statystyk)
Accent 1 (tekst):  #5B2C06  text-spontaway-brown  (tekst na żółtym + guzik secondary)
```

**Brązowy `#5B2C06` to nowy kolor marki** (nie mieszać z `text-foreground` w apce). Pomarańcz
na żółtym ma kontrast 3.08:1, więc tej pary używaj **tylko do dużych nagłówków**, nigdy do
zwykłego tekstu; treść na żółtym pisz brązowym (10:1).

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

### JEDEN pomarańcz primary: `#EE5307` (decyzja Nat 2026-09-08)

Do 8 września w aplikacji żyły **trzy różne pomarańcze**, wszystkie podając się za primary:
`--primary` = `#D25014` (171 użyć `bg-primary`), Tailwind `orange-600` = `#EA580C`
(150 użyć) i `spontaway.orange` = `#EE5307` (landing). Ta strona traktowała pierwsze dwa
jak synonimy, a różnica `--primary` wobec docelowego to **ΔE 13,2** - widać ją od razu,
bez porównywania obok siebie.

Teraz jedna wartość: **`#EE5307`** = `--primary` (`hsl(19.7 94.3% 48%)`, round-trip co do
bajtu) = `spontaway.orange`.

- ✅ Używaj **`bg-primary` / `text-primary` / `border-primary` / `fill-primary`**.
- ⛔ **NIE używaj `*-orange-600`** jako primary - te 150 użyć zostało przepiętych na token.
- Reszta skali `orange-*` (50-500, 700-900) zostaje jako **paleta dekoracyjna** (tła, obwódki,
  gradienty) i NIE udaje primary.
- Wyjątki, które zostały świadomie: `from-orange-600/20`, `to-orange-600`, `shadow-orange-600/30`
  - tam kolor jest częścią efektu przy niskiej przezroczystości, nie wypełnieniem guzika.

### Claim / tagline

Oficjalny tagline aplikacji: **"speed dating z miastem"** (wszystkie litery małe, bez kropek na końcu). Używaj go w headerach stron marketingowych. Nie zastępuj innymi sformułowaniami bez wyraźnej prośby.

### Typografia

- **Główna:** Inter (wszystkie wagi)
- **Nagłówki marki / marketing (landing spontaway):** **Sigmar** (`font-brand`) - zastąpił
  Baloo 2 w warstwie marketingowej (decyzja Nat 2026-09-02). Sigmar ma jedną wagę i pełne
  polskie znaki (subset latin-ext). Ten sam font jest już w apce na liczniku „+N".
- **Akcenty nagłówkowe w apce** (nagłówki sekcji w dzienniku, karty tras): Baloo 2 (`font-display`)
- NIE używaj innych fontów bez wyraźnej prośby

### Przyciski

- **Primary:** **SOLIDNY pomarańczowy fill** (`bg-primary`, jedyny poprawny token), zaokrąglenie **16px** (`rounded-2xl`). ⛔ **ZAKAZ gradientu na guzikach** (`linear-gradient(#F4A259 → #F9662B)` itp.) - domyślny guzik MUSI być jednolicie pomarańczowy. Gradientowy guzik tylko gdy Nat wyraźnie napisze, żeby go wprowadzić (decyzja 2026-08-04). Gradient zostaje wyłącznie dla logo/orba/akcentów tła, NIE dla guzików.
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
- **Ikona panelu ops (`admin.spontaway.com`) = ODWRÓCONE kolory ikony aplikacji** (2026-09-04): kafelek **gradient pomarańczowy** (`#F75708` → `#F9662B`) + **ŻÓŁTE „S"** (`#FDF184`). Celowa różnica, nie niespójność: zakładka panelu zapisana na ekranie domowym telefonu wyglądała identycznie jak apka. NIE ujednolicaj jej z ikoną apki. Pliki `public/ops-icon-1024/180.png` + `ops-favicon.png` żyją **tylko na gałęzi `admin`** (panel buduje się wyłącznie z niej); generator `scripts/gen_ops_icon.py`. `OpsLogo` rysuje ten sam plik co `apple-touch-icon` w `admin.html`, żeby nagłówek panelu i skrót na telefonie się nie rozjechały.
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

## Nawigacja i architektura informacji (IA) — aktualne (2026-09-11)

**BottomNav (native) = 4 pozycje (decyzja Nat 2026-09-13):** pill z ikonami `Eksploracja` · `Miejsca` · `Profil` + OSOBNE kółko `+` po prawej (wzór: nawigacja COSMOS; tworzenie to akcja, nie zakładka). **Ikona + PODPIS pod nią** (10 px; same ikony okazały się za mało czytelne - prośba Nat, wieczór 2026-09-13). Pill jasny (szkło, `NAV_PILL` w [BottomNav.tsx](src/components/layout/BottomNav.tsx)) - wzór jest ciemny, ale ciemne tła są poza marką; target 68 × 52 px, pill h-16, `+` = `Ikona_Dodaj_orange.svg` na całą wysokość (64 px). Ikony z brandowego zestawu SVG (`Ikona_Eksploracja` = kompas, `Ikona_Miejsca`, `Ikona_Profil`, przez `NavIcon` = CSS mask + currentColor). **Eksploracja jest pierwsza i STARTOWA** (route `/eksploruj`). **Zakładka „Główna" (siatka 2 kolumny, `ExploreGrid`) i osobny feed obserwowanych (`/feed`, `Feed.tsx`) USUNIĘTE 2026-09-13** - został jeden widok odkrywania; `/feed` przekierowuje na `/eksploruj`, flaga `followingOnly` w `DiscoveryFeed` zostaje nieużywana. **Zasada „jedno zadanie na widok":**
- **Eksploracja** → `/eksploruj` ([Explore.tsx](src/pages/Explore.tsx)) = **jedna kolumna kafelków** wyjazdów i list od WSZYSTKICH (`DiscoveryFeed city="all"`; **najpierw treści od obserwowanych, pod nimi reszta świata** - dwa koszyki po `following-ids`, w każdym przeplot wyjazd/lista po dacie publikacji), karta po karcie ze snapem (`snap-y snap-mandatory` na scrollerze tylko poza szukaniem). Kafelki = [FeedTiles.tsx](src/components/home/FeedTiles.tsx) (`GridTile size="feed"`, makieta Nat 2026-09-13): **WYJAZD** = okładka ZAWSZE **9:16** (`aspect-[9/16]`, `object-cover`; bez karuzeli zdjęć - usunięta 2026-09-13), pomarańczowa pigułka autora (awatar z ramką + @nazwa) w lewym górnym rogu, kwadratowa mini-mapa **108 px** (`buildTripStaticMapUrl(pins, "200x200")`) w prawym; **tytuł 36 px, chipy 30 px / tekst 14 px** (wymiary z makiety „Majówka 2025", wieczór 2026-09-13; wcześniej 24 / 26 / 72 px) - **tapnięcie ROZWIJA ją** do żywej `RouteMap` na 62 % okładki (te same markery co w wyjeździe; instancja Google montuje się DOPIERO po rozwinięciu, `Minimize2` zwija, pigułka autora chowa się na ten czas; przywrócone z `TrasaBigCard` na prośbę Nat 2026-09-13), tytuł + chipy u dołu (pinezka + liczba miejsc, miasto, dni); **LISTA** = kolorowe tło z palety ([listThemes.ts](src/lib/listThemes.ts), `discovery_collections.theme`, NULL = stały kolor z id; autor wybiera w menu „…" listy → [ListThemeSheet](src/components/lists/ListThemeSheet.tsx)) + mini-siatka miejsc 3 × 2 (przy > 6 „+N", chip kategorii = napis w feedzie / ikona w wariancie grid) + pigułka autora + tytuł + chipy (**„odwiedzone przez AUTORA / wszystkie"** np. `9/13` z RPC `list_author_visit_counts(uuid[])`, migracja 20260913c, `fetchListVisitCounts` w [placeVisits.ts](src/lib/placeVisits.ts); przy 0 sama liczba; miasto). Bez bookmarka na kafelkach (zapis z widoku wyjazdu/listy). `TrasaBigCard` zostaje na profilach i w podglądzie udostępniania; przełącznik `FEED_TRIPS_AS_TILES` w [DiscoveryFeed.tsx](src/components/home/DiscoveryFeed.tsx) (`false` = stara pełnoekranowa karta). Przypięta wyszukiwarka zostaje (wyniki nadal renderuje `DiscoveryFeed` w trybie `searchOnly`). Flaga `SHOW_ZESTAWIENIA` = `true`.
- **`+` (FAB)** → `CreateFlowSheet` [Lista|Wyjazd] (bez zmian).
- **Miejsca** → `/miejsca` ([Miejsca.tsx](src/pages/Miejsca.tsx)) = wizytówki miejsc (`ExploreSwiper`, dawny widok „browse" spod przełącznika). W belce **przypięte pole wyszukiwarki + dzwonek** (jak w Eksploracji; 2026-09-14 - tytuł „Wizytówki" i sama lupka odrzucone), segment `Wydarzenia (wkrótce)` USUNIĘTY 2026-09-13 (wraca razem z realnym widokiem wydarzeń od klientów biznesowych). ⛔ Nad swiperem NIE może stanąć nic poza `TabTopBar` (zamrożony sizing karty 9:16 liczy się ze stałego chrome).
- **Profil** → `/moj-profil` (bez zmian).
- **Wyszukiwarka na KAŻDEJ zakładce (2026-09-11):** wspólny moduł [TabSearch.tsx](src/components/home/TabSearch.tsx) (`useTabSearch` + `TabSearchField` + `TabSearchButton` + `SearchPane`/`TabSearchResults`; wyniki = `DiscoveryFeed searchOnly`). **Bez frazy = lista kategorii JEDNA POD DRUGĄ** (`SearchCategoryList`: Listy / Wyjazdy / Miejsca / Ludzie, ikona + nazwa + podtytuł + strzałka, wzór FYI) zamiast rzędu folderów; tapnięcie w kategorię = wyniki tylko z niej (każda jako lista pionowa, nie siatka); strzałka w belce najpierw wraca do listy kategorii, potem zamyka szukanie. `SearchCategoryRow` (rząd folderów) nie jest już używany w wyszukiwarce. Feed: pole na całą szerokość belki (bez logo i tytułu). Eksploruj: własna belka `ExploreTopBar` (bez zmian). Miejsca: pole przypięte obok dzwonka (od 2026-09-14); w trybie wyników belka pokazuje tylko strzałkę + pole (wysokość belki stała = 52 px, swiper zostaje zamontowany pod spodem). Tryb wyników chowa BottomNav. **Dzwonek i lupka w belkach = OKRĄGŁE `h-9 w-9 rounded-full bg-muted/70 border border-border/50`** (2026-09-13, ten sam styl co pigułka szukania; wcześniej kwadraty `rounded-xl`).
- **Karta zaproszeń na profilu ([ReferralCard](src/components/profile/ReferralCard.tsx), 2026-09-11, wzór „Get credits" z FYI):** sam kreskowany szary obrys, OSTRE krawędzie KARTY (świadomy wyjątek od zaokrągleń - ma wyglądać jak kupon), mała pomarańczowa ikona + eyebrow, guzik primary pełnej szerokości + kwadrat z kodem QR obok (oba **zaokrąglone `rounded-2xl`** od 2026-09-13 - ostre guziki wyglądały jak obcy element), „Nie teraz" pod spodem.
- **Wyróżnione miejsca na profilu (2026-09-13):** trzecia statystyka w rzędzie Obserwujący / Obserwowani = **gwiazdka „topki" + licznik** miejsc, które user wyróżnił w SWOICH wyjazdach (`pins.is_top`) i listach (`discovery_items.is_top`, migracja 20260913b; toggle w menu wiersza w [SharedList](src/pages/SharedList.tsx)). **Gwiazdek jest BEZ LIMITU - w wyjazdach i kolekcjach** (decyzja Nat 2026-09-14; do tego dnia wyjazd miał `TOP_LIMIT = 1` i kolejny wybór przenosił gwiazdkę - stała nie istnieje, [topPlaces.ts](src/lib/topPlaces.ts) trzyma tylko historię decyzji). Tap → [StarredPlacesSheet](src/components/profile/StarredPlacesSheet.tsx) (lista miejsc + skąd gwiazdka, tap = wyjazd/lista). **Także na profilu publicznym** (`own={false}` = opisy w trzeciej osobie), gdzie guzik „Obserwuj" to od 2026-09-13 **sama ikona** (`FollowButton iconOnly`: pomarańczowe kółko z `UserPlus`, po zaobserwowaniu szare z `UserCheck`) - trzy statystyki w rzędzie nie zostawiały miejsca na pigułkę z tekstem. **Zgłoszenie profilu = sama flaga w górnej belce po prawej**, obok „⋮" z blokadą (oba przeniesione z rzędu statystyk, który przy trzech licznikach wystawał poza ekran). Dane: [starredPlaces.ts](src/lib/starredPlaces.ts), klucz `["starred-places", userId]` - inwaliduj po każdym toggle'u gwiazdki.
- **Awatary brandowe (2026-09-13):** 12 presetów = **same kolory** z palety marki (bez znaku „S" - wersja ze znakiem odrzucona przez Nat), generator `scripts/gen_avatar_presets.py` → `public/avatars/preset-<id>.png` + kopie w buckecie `avatars/presets/v2/` (wersja w ścieżce, bo pliki idą z cache na rok; profil zapisuje PEŁNY URL jak przy własnym zdjęciu). Lista id + URL: [avatarPresets.ts](src/lib/avatarPresets.ts); rząd do wyboru [AvatarPresetRow](src/components/profile/AvatarPresetRow.tsx) w kroku „zdjęcie" onboardingu i **w arkuszu „Customizuj" NA DOLE, pod nakładkami i kolorem** (prop `flush`, zapis od razu do `profiles.avatar_url` - prośba Nat 2026-09-13; wcześniej rząd siedział w formularzu Ustawień, tam go już NIE ma). Nowy preset = wpis w `AVATAR_PRESET_IDS` + wygenerowany i wgrany plik.
- **Ramki awatara (2026-09-11):** `profiles.avatar_frame` (`stars` | `hearts` | `clouds` | null) + `profiles.avatar_frame_color` (`#RRGGBB` | null = pomarańcz marki `#EE5307`; migracje 20260911f/g - kolumny PUBLICZNE jak `avatar_url`, dopisane do kolumnowych grantów SELECT/UPDATE). Wejście: Ustawienia, guzik „Customizuj" **bezpośrednio pod awatarem** (ikona = żywa miniatura nakładki, nie statyczny sparkle) → [AvatarFrameSheet](src/components/profile/AvatarFrameSheet.tsx): podgląd na własnym zdjęciu, zapis od razu, kolor = szybkie kolory + pipeta (`<input type="color">`, dowolny kolor). **Wszystkie nakładki domyślnie pomarańczowe**, jeden kolor na całą ramkę (`currentColor`). **Nakładka-NAGRODA `rainbow`** (tęczowy świecący PIERŚCIEŃ - kółko, nie kwadrat; kolor usera bez znaczenia) odblokowuje się po zaproszeniu `REFERRAL_GOAL` (3) osób albo z grantu w `frame_grants` (Nat ma grant). Blokadę egzekwuje **baza**: trigger `guard_avatar_frame` → `frame_unlocked(uid, frame)` odrzuca zapis (`frame_locked`); arkusz czyta stan z RPC `my_frame_unlocks()` i pokazuje kłódkę + postęp „0 z 3". Baner zaproszeń na profilu obiecuje właśnie tę nakładkę (migracja 20260911h). Nowa nagroda = wiersz w `AVATAR_FRAMES` z `reward: true` + gałąź w `frame_unlocked`. Render: [AvatarFrame](src/components/profile/AvatarFrame.tsx) = nakładka `pointer-events-none` obok `<Avatar>` w elemencie `relative`; znaczki LEŻĄ na krawędzi zdjęcia (orbita 0,94 × średnica), 14 s/obrót, kontr-rotacja, `motion-reduce`. ⛔ Gwiazdka w nakładce = **INLINE svg** (`StarGlyph`, ścieżka z `Ikona_Gwiazdka.svg`), NIE `BrandIcon`/CSS mask - WebKit na iOS gubił `-webkit-mask-image` wewnątrz animowanej warstwy (gwiazdki znikały w arkuszu udostępniania i na kafelkach eksploracji, 2026-09-13). Pipeta koloru w arkuszu = SAM natywny `<input type="color">` rozciągnięty na kropkę (bez guzika pod spodem - podwójne otwarcie palety) + podgląd na żywo z `draft`, zapis odroczony 600 ms / na `change` (iOS strzela `input` przy każdym ruchu palca). Małe awatary w nagłówkach wyjazdu i listy przez [FramedAvatar](src/components/profile/FramedAvatar.tsx). Lista wariantów = [avatarFrames.ts](src/lib/avatarFrames.ts). **Widoczna WSZĘDZIE, gdzie jest awatar osoby (prośba Nat 2026-09-11):** własny profil (76 px, BEZ plakietki aparatu - zasłaniała nakładkę; tapnięcie w awatar prowadzi do Ustawień, gdzie żyje zmiana zdjęcia i „Customizuj"), profil publiczny, karty list i wyjazdów na obu profilach (własne + zapisane od innych), autor na kartach feedu/wyszukiwarki (`AuthorChip`, `TrasaBigCard`), wiersze ludzi (wyszukiwarka, polecani), nagłówki wyjazdu i listy, **pigułka autora w lewym górnym rogu kafelka w Eksploracji** (`FeedTiles` `AuthorPill`, awatar 24 px; ukryta dla wyjazdów anonimowych) oraz **arkusz udostępniania** (awatar autora z nakładką po prawej od „udostępnij", `ShareSheet author`). Ramkę cudzego usera bierz przez [avatarFrameLoader](src/lib/avatarFrameLoader.ts) (`useAvatarFrame(userId)` - zbiera pytania z jednego renderu w JEDNO zapytanie `in(...)`, cache 5 min, klucz `["avatar-frame", userId]`) albo gotowe komponenty w [FramedAvatar.tsx](src/components/profile/FramedAvatar.tsx): `FramedAvatar` (ramka podana wprost), `UserAvatar` (ramka po `userId`), `UserFrameRing` (sama ramka obok istniejącego `<Avatar>`). NIE dopisuj kolumn `avatar_frame*` do kolejnych zapytań o autorów - podaj `userId`. Nowy wariant = wpis w `AVATAR_FRAMES` + glyph w `AvatarFrame` + CHECK w bazie.
- **Udostępnianie miejsca (2026-09-11):** „Udostępnij to miejsce" w [SavePlaceSheet](src/components/plan-wizard/SavePlaceSheet.tsx) → arkusz `ShareCardPlace` (ta sama karta co w Miejscach, `SwipeCard scrollMode`) + link **`spontaway.com/p/<places.id>`** (serwer: [api/share.ts](api/share.ts) `t=place`, OG + karta + „Zobacz miejsce" + pasek przedpremierowy). Działa dla **KAŻDEGO** miejsca: wizytówka z bazy → `/p/<places.id>` z pełnymi danymi; miejsce spoza bazy (z listy, wyjazdu, Google) → **migawka** w `shared_places` (migracja 20260911e; jedna na usera i miejsce, klucz = google_place_id albo nazwa; public read, insert/update tylko autora) → `/p/<shared_places.id>`, a serwer próbuje najpierw `places`, potem migawki. `buildShareUrl("/miejsce/<id>")` → `/p/<id>`. Link do Google Maps zostaje wyłącznie jako awaria (błąd zapisu migawki). **Logika udostępniania miejsca żyje w hooku [usePlaceShare](src/hooks/usePlaceShare.tsx)** (zdjęcia, migawka, link, arkusz) - używają go SavePlaceSheet i **wizytówka** (`PlaceSwiperDetail`: żółte kółko z brązową ikoną obok „Zapisz to miejsce", 2026-09-13). **Zdjęcia:** karta w arkuszu renderuje się ze `skipGoogleFetch`, więc NIC sama nie dociąga - hook zbiera zdjęcia ze WSZYSTKICH źródeł wizytówki (wiersz, `fetchEnrichedPlace`, `fetchPlaceUserPhotos` = piny + `place_photos`), pierwsze = okładka, a **tapnięcie w kartę przełącza na kolejne zdjęcie** (w kółko, z delikatną haptyką `haptics.light()`; BEZ pigułki „Zmień zdjęcie" i bez osobnego arkusza wyboru - oba odrzucone 2026-09-13). **Karta w arkuszu = `SwipeCard shareMode`**: samo zdjęcie + plakietka kategorii + nazwa + adres; bez chipa dystansu, cen, tagów i kolumny zapisz/rozwiń (prośba Nat 2026-09-13 - odbiorca linku i tak ich nie dostaje). Wybór jedzie do `shared_places.photo_url` (wizytówka z bazy dostaje wtedy migawkę z `place_id` i link `/p/<migawka>`), a serwer bierze zdjęcie z migawki PRZED własnymi źródłami; ostatni fallback serwera = zdjęcia userów z opublikowanych wyjazdów (`pins`). **Udostępnianie WYJAZDU pokazuje miejsca po dniach (`pins.day_index`) w JEDNYM przewijanym rzędzie: dzień 1 → pionowy divider „Dzień 2" → dzień 2 → kafelek „Jeszcze N miejsc zobaczysz w aplikacji"; dalsze dni tylko w aplikacji** (decyzja Nat 2026-09-14; osobne rzędy na dzień odrzucone) - tak samo w arkuszu w apce (`ShareSheet strip: StripEntry[]`), na zapowiedzi linku w apce i na stronie `/r/<id>` w `api/share.ts`. ⛔ **Arkusz udostępniania renderuje się WEWNĄTRZ gospodarza** (drawer vaul wizytówki / `Sheet` zapisu), więc jego korzeń ma `data-vaul-no-drag data-no-drag` (przeciągnięcie po żółtym arkuszu zamykało gospodarza), a hook dostaje `{ hostOpen }` i **zeruje stan, gdy gospodarz się zamyka** - bez tego stary arkusz wracał na wierzch przy następnej wizytówce („nie mogę wejść w wizytówkę innego miejsca", zgłoszenie Nat 2026-09-13).
- Stare wejścia: `/plan` z `exploreMode` i `/eksploruj` ze `state.view === "browse"` przekierowują na `/miejsca`; event `trasa:explore-nearby` nawiguje na `/miejsca` ze `state.nearby`.
- **Onboarding (2026-09-13) = DOKŁADNIE 5 kroków** ([OnboardingFlow](src/components/onboarding/OnboardingFlow.tsx), stepper zostaje): welcome (regulamin) → „Skąd znasz" → „W jakim celu" (multi, z opcją „Jeszcze nie wiem") → **PROFIL na jednym ekranie** (zdjęcie/awatar bazowy + imię + nazwa użytkownika + **płeć** - pigułki, wymagana, z „Wolę nie podawać"; `onboarding_responses.gender`, migracja `20260913g`, NIE `profiles`) → zgoda na analitykę (copy bez „nie sprzedajemy danych"). Kroki „miasto zamieszkania", „powiadomienia" i „lokalizacja" USUNIĘTE - o zgody systemowe pytamy w chwili użycia. Po 5. kroku user ląduje w Eksploracji i **coach-marki ([OnboardingGuide](src/components/OnboardingGuide.tsx)) prowadzą go po KAŻDEJ zakładce**: Eksploracja → Miejsca → Profil → „+" (cele `data-ob="nav-eksploruj|nav-miejsca|nav-profil|nav-fab"`, każdy krok nawiguje na swój ekran przez `route`); dawny krok „zapis" bez celu zniknął.
- Web/PWA (stary flow, `!PLANNING_DISABLED`): bez Eksploracji/Miejsc; w pillu `Wyjazdy` (`/home`) · `Profil` + `+`, start = `/eksploruj` (waitlista).

**Historia:** 2026-08-20 → 2026-09-11 pasek miał 3 pozycje (`Eksploruj` · `+` · `Profil`), a wizytówki miejsc siedziały pod przełącznikiem Trasy|Miejsca w eksploracji. 2026-09-11 → 2026-09-13: 5 pozycji z podpisami (`Główna` (siatka) · `Eksploracja` (feed obserwowanych) · `+` · `Miejsca` · `Profil`).

**Nazewnictwo „Kolekcje" (decyzja Nat 2026-09-13):** w CAŁEJ warstwie UI dawne „Listy" nazywają się **„Kolekcje"** (PL: kolekcja / kolekcji / kolekcję / kolekcje, „w kolekcji", nie „na liście"; EN: collection / collections). Dotyczy locale (`*.json`), copy pushy w `notify_push` (migracja `20260913e`) i strony linku (`api/share.ts`). **Kod, routy i tabele ZOSTAJĄ po staremu** (`/lista/:id`, `discovery_collections`, `SharedList`, klucze `list_*`, `tab=listy`) - to tylko słowo w interfejsie. Generyczna „lista" (widok listy, lista oczekujących, cennik, „nie ma na liście") NIE jest kolekcją i zostaje. Landing spontaway („Twórz własne kolekcje tematyczne") też zmieniony. Ta dokumentacja używa obu słów zamiennie tam, gdzie mówi o kodzie.

**Imię i nazwa użytkownika (2026-09-14):** nazwa = max 20 znaków (`USERNAME_MAX`, reguły w [usernameRules.ts](src/lib/usernameRules.ts) + wyzwalacz `reject_banned_username`), **imię = max 30 znaków, same litery (myślnik/apostrof ok), bez wulgaryzmów** (`checkFirstName` + wyzwalacz `reject_banned_first_name`, migracja `20260914b`; do tego dnia imię nie było sprawdzane wcale - „Cipa" przechodziło). Lista słów = [profanity.ts](src/lib/profanity.ts) po stronie klienta i tabela `banned_usernames` w bazie - dopisując słowo, dopisz w OBU. Liczniki znaków przy obu polach w onboardingu i Ustawieniach.

**Profil (`/moj-profil`, [TravelerProfile.tsx](src/pages/TravelerProfile.tsx)) = hub z 2 zakładkami** (`?tab=listy|wyjazdy`). **Kolejność pigułek: Wyjazdy | Kolekcje** (w kodzie nadal `listy`), domyślnie otwiera się **Wyjazdy** (zmiana 2026-08-30) - tak samo na profilu publicznym. **Wejście bez parametrów (pasek, powrót) ZAWSZE ląduje na Wyjazdy → Opublikowane** (prośba Nat 2026-09-14; efekt od `searchParams` resetuje podzakładki, gdy `?sub=` nie ma - deep-linki `?tab=&sub=` działają jak dotąd). **Zaznaczona pigułka podzakładki = żółta `#FDF184` z brązowym tekstem `#5B2C06`** (`TabSelect`; pomarańcz odrzucony 2026-09-14). **Zakładka „Zapisane" USUNIĘTA 2026-08-24** - zapisane miejsca żyją w LIŚCIE OGÓLNEJ (wishlista `to_visit`, patrz niżej), niewidocznej jako tab; pojawiają się przy tworzeniu listy/wyjazdu. Wewnątrz Listy i Wyjazdy są **podzakładki** (dropdown w stylu iOS, komponent lokalny `TabSelect`):
1. **Listy** — pigułki `[Moje listy | Zapisane]` (domyślnie **Moje listy**):
   - **Moje listy** — kuratorskie **publiczne polecajki** usera (`discovery_collections`, `kind='ranking'`, `list_status='visited'`). Grupy miejsc do polecenia, NIE luźne zapisy.
   - **Zapisane** — listy zapisane **od innych** userów. Komponent [SavedCollections](src/components/home/DiscoveryFeed.tsx) (localStorage `trasa_saved_collections`). Karta zapisanej listy: licznik zapisów TYLKO w nagłówku przy dacie, BEZ zakładki w stopce (2026-09-13) - odpięcie listy żyje w jej widoku.
2. **Wyjazdy** (dawny Dziennik) — pigułki `[Robocze | Wspomnienia | Zapisane]` (domyślnie **Wspomnienia**):
   - **Robocze** — trasy usera `status != 'published'` (niepublikowane, badge „Robocze"). **Wspomnienia** — `status = 'published'`. Publikacja = „Zapisz trasę" (patrz model roboczy→przeszły). Karta renderowana wspólnym helperem `renderTripCard` (przekazuje `status/is_shared/trip_type` z zapytania `profile-trip-feed`).
   - **Zapisane** — trasy zapisane **od innych** userów (`saved_routes`). Komponent [SavedRoutes](src/components/home/DiscoveryFeed.tsx) z `city="all"`.
   - **Układy Wspomnień** ([TripLayout.tsx](src/components/profile/TripLayout.tsx)): lista | mozaika | siatka, wybór oglądającego w localStorage. ⛔ Mozaika = DWIE kolumny flex z rozdziałem naprzemiennym (`mosaicColumns`), NIE CSS `columns-2` - WebKit gubi malowanie i trafianie palcem w drugiej kolumnie przy warstwach kompozytowanych (ten sam błąd co w ExploreGrid). Ten sam podział na własnym i publicznym profilu.
   - **„Przytrzymaj i przestaw" (2026-09-11):** na siatce i mozaice własnego profilu przytrzymanie kafelka (420 ms) podnosi go (duch w portalu, haptyka), przeciągnięcie przestawia okładki, puszczenie zapisuje kolejność w `profile_trip_order` (jedna tablica `route_ids` na usera, migracja `20260911i`; [tripOrder.ts](src/lib/tripOrder.ts): `applyTripOrder` = nieznane/nowe wyjazdy NA POCZĄTKU, usunięte pomijane). Kolejność jest WSPÓLNA dla wszystkich (profil publiczny czyta tę samą tablicę, bez edycji); lista pełnych kart tylko ją pokazuje. Gest = wspólny hook [useLongPressReorder](src/hooks/useLongPressReorder.tsx) (patrz „Gesty natywne"). Podpowiedź pod pigułkami (`tab_hints.trips_wspomnienia_reorder`) zamiast dymka.
**Lista „Ogólne" (2026-08-24):** = **JEDYNA prywatna lista** każdego usera. JEDNA, globalna kolekcja (`kind='ranking'`, `list_status='to_visit'`, `is_public=false`, `city=null`, `title='Ogólne'`), get-or-create przez `ensureToVisitList` (`city` param IGNOROWANY - już NIE per-miasto; skonsolidowane migracją `20260824b`). **Nie podlega moderacji** (`guard_discovery_moderation`: `is_public=false` → `moderation_status='approved'`). Wszystkie inne listy (`visited`) są PUBLICZNE. Każde „Zapisz" (drawer [SavePlaceSheet](src/components/plan-wizard/SavePlaceSheet.tsx)) auto-zapisuje miejsce do „Ogólne" (`quickSavePlace`) + pozwala **dodatkowo** dodać do istniejącej/nowej listy (`visited`, publicznej). W drawerze „Ogólne" ZAWSZE na górze i zaznaczone (wiersz wirtualny). Na profilu: **opcja „Ogólne" w dropdownie zakładki Listy** (`[Moje listy | Ogólne | Zapisane]`, `listyTab='ogolne'`) → renderuje `SavedPlacesGrid` inline. Przy tworzeniu pokazuje `fetchSavedPlaces` (płaska, WSZYSTKIE miasta): [CreateFlowSheet](src/components/create/CreateFlowSheet.tsx), [CreateRanking](src/pages/CreateRanking.tsx), [ComposeWyjazd](src/pages/ComposeWyjazd.tsx) (wyjazd = też wszystkie, Ogólne jest globalna). `SavedListsRoutes` = martwy kod.

**Widok wyjazdu i listy - nagłówek (redesign Nat 2026-09-13, makieta „Łódzki citybreak"):** wspólny moduł [TripHeaderChips.tsx](src/components/route/TripHeaderChips.tsx). Belka: **wstecz = chevron w BIAŁYM kółku z szarym obrysem** (`bg-white border-border`; peachy odrzucone), **autor jako pigułka** (`AuthorPill`: peachy, CZARNY `@nick`, awatar z ramką - nakładka ZOSTAJE) + po prawej: gość = **flaga zgłoszenia** (`ReportContentSheet` z własnym triggerem; wcześniej link „Zgłoś" pod listą miejsc); właściciel/uczestnik = **menu „…" w BELCE** (białe kółko z delikatnym cieniem `shadow-[0_1px_5px_rgba(0,0,0,0.12)]`; w wyjeździe obok żółtego kółka udostępniania) - przy tytule nie ma już żadnych guzików poza polubieniem. Menu kolekcji: nazwa · **Kraj i miasto** ([ListScopeSheet](src/components/lists/ListScopeSheet.tsx), 2026-09-14: ten sam `CountryPicker` co przy tworzeniu + opcjonalne miasto z chipów pierwszego kraju albo wpisane; zapis `discovery_collections.countries/city`, chip pod nazwą = miasto albo kraje przez `scopeLabel`) · tło · usuń. **Polubienie = BRANDOWE SERCE na wysokości tytułu** (`BrandHeart` w [BrandHeart.tsx](src/components/BrandHeart.tsx) = inline svg z `public/Ikona_serce.svg`, kontur = nie polubione / pełne = polubione, jak `BrandStar`; NIE lucide `Heart`; tylko wyjazd, tylko gość; licznik gdy > 0) - z animacją w [TripLikeButton](src/components/route/TripLikeButton.tsx) (2026-09-14): polubienie = serce pompuje się sprężyną, fala na zewnątrz, sześć małych serduszek na boki, licznik wjeżdża od dołu, haptyka średnia; cofnięcie = serce się sflacza z przechyłem, fala zapada do środka, haptyka lekka. Gra na tapnięciu (stan optymistyczny), nie na odpowiedzi serwera. Gwiazdka zostaje wyłącznie dla „topki" (`BrandStar` w [BrandStar.tsx](src/components/BrandStar.tsx) = brandowa gwiazdka z konturem, gdyby była potrzebna). **Daty wyjazdu pod chipami = sama informacja** (ikona kalendarza + zakres, bez ołówka); ustawianie/zmiana dat żyje w menu „…" w belce („Dodaj daty wyjazdu" / „Zmień daty wyjazdu", tylko właściciel; wiersz „Dodaj daty" pod tytułem usunięty 2026-09-13). **Udostępnianie = brandowe ŻÓŁTE kółko z brązową ikoną bezpośrednio NA PRAWO od dolnego CTA** („Zapisz ten wyjazd" u gościa; na liście obok „Zapisz tę listę" / „Dodaj nowe miejsce"). **Chipy dni** w wyjeździe: zaznaczony = peachy `#FCEDE3` + brązowy tekst (NIE pomarańcz, NIE żółty). Pod tytułem **chipy z SAMYM OBRYSEM** (`HighlightChips`, bez wypełnienia, **jeden szary obrys `#D9D9D9` 1,5 px dla wszystkich** - kolorowe obrysy i `border-2` odrzucone 2026-09-13, brązowy tekst): miasto (`route.city` przed krajami), liczba miejsc (copy z polską odmianą i wielką literą „15 Miejsc", a w kolekcji **„7 / 15 Miejsc"** = odwiedzone / wszystkie: moje odwiedziny na własnej kolekcji, autora na cudzej), wyróżnione gwiazdką (tylko gdy > 0) - ikony chipów to BRANDOWE SVG (`Ikona_Miejsca` w brązie `#5B2C06`, `Ikona_Gwiazdka` pomarańczowa) **w środku pigułki**, 18 px w linii z tekstem (wariant z ikoną wychodzącą poza obrys odrzucony 2026-09-14). Opis wyjazdu/listy `text-[15px] text-foreground/80`. Wiersz miejsca ([RoutePlaceRow](src/components/route/RoutePlaceRow.tsx)): miniatura 2:3 `w-16 h-24 self-start` (wariant rozciągany odrzucony), chip kategorii peach + brąz, akcje w kółkach 40 px: **gwiazdka „topki"** (pierwsze kółko od lewej; tylko gdy `onToggleTop`) · Google · **dodaj zdjęcie** (pomarańczowe kółko, brandowy aparat `CAMERA_ICON` = `public/aparat.svg` w żółtym `#FDF184` + mały plus) · „…" z resztą (w tym „dodaj notkę" - osobne kółko notki odrzucone jako zagęszczające) - zdjęcie wychodzi z `menuExtras` po kluczu `photo`, callery bez zmian. **Gwiazdka (wieczór 2026-09-13): tap = przełącz z lotem gwiazdki do nazwy (jak dotąd); PRZYTRZYMANIE = „ładowanie"** - po 180 ms wokół kółka rośnie pierścień (żółty tor, pomarańczowy postęp, ~1 s), haptyka NARASTA w progach (light ×2, medium ×2, na końcu heavy + success), a pełne naładowanie **przypieczętowuje** gwiazdkę (ta sama akcja `onToggleTop`, ale z pieczątką: odbicie kółka + fala + rozprysk, bez lotu). Puszczenie przed końcem = nic. Gwiazdka już przypięta nie ładuje się (tap ją zdejmuje). Postęp idzie w refach prosto w style (bez setState co klatkę). ⛔ **Werdykty przy miejscach („Musisz odwiedzić!" / „Warto wpaść" / „Przy okazji") USUNIĘTE z apki 2026-09-13** - jedynym wyróżnieniem miejsca jest gwiazdka; `pin_ratings.verdict` i stare wartości w `pins.tags` zostają w bazie, ale `verdictOf` służy już tylko do ich POMIJANIA przy renderze (wiersz, `PlaceNotes`, pasek udostępniania), a sortowanie „Wszystkie" ma tylko gwiazdkę. **Pływające akcje wyjazdu (`TripFabStack`): rozwinięcie przyciemnia ekran (`bg-black/35`) i każde kółko ma podpis w białej pigułce** („Zmień kolejność", „Dodaj miejsce", „Czat" = `sharing:fabs.chat`). **„Odwiedzone" = ŻÓŁTA pigułka (`#FDF184`) POD miniaturką: awatar + podwójny ptaszek (`CheckCheck`), bez napisu** - na cudzej liście awatar autora, na własnej mój; przełącznik „byłem tu" na WŁASNEJ liście siedzi w menu „…" (2026-09-13; wcześniej osobne kółko z ptaszkiem i pigułka z napisem). **Notka albo zdjęcie dodane do miejsca we WŁASNEJ kolekcji odhacza je jako odwiedzone automatycznie** (`markVisitedAuto` w [SharedList](src/pages/SharedList.tsx), 2026-09-14; toast „Odhaczono jako odwiedzone" z „Cofnij"; tylko gdy jeszcze nie odhaczone). Kolumna treści wiersza ma `min-h-24` i składa akcje na dole (`mt-auto`) - miejsce bez notki i zdjęć (stan zero) jest zwartym wierszem z kółkami na wysokości dolnej krawędzi miniatury. **Zakładka „zapisz" = brandowa `SAVE_ICON` (`Ikona_Zapisane.svg`)** w wierszu, menu i CTA „Zapisz ten wyjazd / tę listę" - NIE lucide `Bookmark`.

**Profil publiczny (cudzy) — `/profil/:username`, [PublicProfile.tsx](src/pages/PublicProfile.tsx):** ten sam layout kart, ale **2 zakładki** (Listy · Wyjazdy), bez „Zapisane", tylko listy `visited`, **bez edycji/usuwania** (owner-only).

**⛔ USUNIĘTE ekrany (2026-08-20):** `/dziennik` (Journal) i `/polubione` (LikedPlaces) — cała treść przeniesiona do zakładek profilu. `Journal.tsx` + `LikedPlaces.tsx` usunięte. **Routy zostają jako `<Navigate>` redirecty** (stare deep-linki / pushe nie ubijają apki): `/dziennik` → `/moj-profil?tab=wyjazdy`, `/polubione` → `/moj-profil` (dawniej `?tab=zapisane`, zakładka usunięta 2026-08-24). Nowy kod nawiguj **wprost** na `/moj-profil?tab=…`, nie na `/dziennik`/`/polubione`. **`JournalTab` ZOSTAJE** (reused w [CreateDrafts](src/pages/CreateDrafts.tsx) „Robocze", route `/utworz/robocze`).

**Model prywatności list (patrz też memory `project_place_lists_model`):** zapis miejsca = **prywatna** lista „Do zobaczenia" (`list_status='to_visit'`, `is_public=false`). Świadoma **publiczna** polecajka = `list_status='visited'`, `is_public=true`. Bookmark ≠ polecenie.

**Polubienia + powiadomienia (2026-08-20):** tabele `likes` (trasy) i `collection_likes` (listy) + kolumny `likes_count`. Powiadomienia `route_liked` / `list_liked` (serce) i `list_saved` (bookmark) wstawiane triggerami **SECURITY DEFINER** (klient nie ma INSERT na `notifications`). Helpery: [src/lib/likes.ts](src/lib/likes.ts). Zapis cudzej trasy woła RPC `notify_route_used`, zapis listy `notify_collection_saved`.

**Opis wyjazdu = `routes.review_narrative` (właściciel edytuje go w miejscu „Dodaj / Edytuj opis"); notka WŁAŚCICIELA w `route_member_covers.note` to ten sam głos** - gdy opisu nie ma, jest opisem (czysty tekst pod tytułem) i NIGDY nie renderuje się jako dymek pod spodem (dymki = notki pozostałych uczestników; zgłoszenie Nat 2026-09-14 „Majówka 2025", dane przeniesione migracją `20260914_owner_trip_note_to_description`). **Zmiana nazwy wyjazdu/kolekcji z menu „…"**: menu ma `onCloseAutoFocus={preventDefault}` (Radix oddawał fokus guzikowi i klawiatura nie wchodziła), pole dostaje fokus z efektu, a dolny pasek CTA i stos akcji są schowane na czas edycji (`editingName`).

**Notka o miejscu = JEDNA na (user, miejsce) - wszędzie (decyzja Nat 2026-09-13, migracja `20260913f_place_note_sync.sql`):** dawniej notka żyła per wiersz (`discovery_items.short_desc` w każdej kolekcji osobno, `pin_ratings.note` w każdym wyjeździe osobno). Teraz tabele mają ten sam kształt, ale **triggery je synchronizują**: zapis notki w dowolnym miejscu → `propagate_place_note(user, nazwa, notka)` rozchodzi ją na wszystkie kolekcje usera (także prywatną „Ogólne"), wszystkie jego wiersze `pin_ratings` i **wyjazdy usera** (`routes.user_id`) z tym miejscem (wiersz `pin_ratings` powstaje, gdy go nie było); nowa pozycja kolekcji / nowy pin dostaje istniejącą notkę od razu (`list_item_note_prefill`, `pin_note_prefill` dla `added_by`/właściciela). Tożsamość miejsca = **znormalizowana nazwa** (`place_note_key` = lower/trim), ta sama reguła co `place_photos` `nm:<nazwa>` - sieciówka o tej samej nazwie w dwóch miastach dzieli notkę (świadome uproszczenie). Rekurencję wycisza flaga `trasa.note_sync` (transakcyjna). Wyczyszczenie notki w jednym miejscu czyści ją wszędzie. **Konsekwencja prywatności:** notka napisana w prywatnym wyjeździe jest tą samą notką, co w publicznej kolekcji z tym miejscem - i tam jest widoczna. Wizytówka „Od użytkowników" (`fetchPlaceNotes`) dedupuje **po `user_id`** (jedna notka na osobę) i bierze nazwę/awatar z `profiles` dla obu źródeł. Backfill: przy konflikcie wygrała notka z kolekcji, potem dłuższa (5 konfliktów, 4 u Nat).

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
4a. **Wizytówka z dodawania miejsc (2026-09-13):** `PlaceSwiperDetail` otwarta z [route/AddPlaceSheet](src/components/route/AddPlaceSheet.tsx) i [CreateFlowSheet](src/components/create/CreateFlowSheet.tsx) dostaje `onAdd`/`added` = toggle z wiersza, z którego ją otwarto → rząd **„Zapisz" (szary, brandowa zakładka `SAVE_ICON`) · „Dodaj" (primary, brandowy plus `PLUS_ICON` = `public/Ikona_Plus.svg`, same kreski z `Ikona_Dodaj.svg`) · żółte kółko udostępniania** (krótkie napisy od 2026-09-14 - trzy guziki nie mieściły pełnych zdań); po dodaniu wizytówka się zamyka, „Dodano" = już zaznaczone / już w wyjeździe (guzik nieaktywny, odznaczenie na wierszu). Poza dodawaniem zostaje „Zapisz to miejsce" (z tą samą brandową zakładką) + udostępnianie.
5. `skipGoogleFetch` prop w PlaceSwiperDetail/SwipeCard: używaj `false` dla fullscreen drawer (żeby były recenzje i zdjęcia Google), `true` tylko gdy zależy Ci na szybkości i masz własne zdjęcia
6. **Mapa „Wybierz z mapy" ([PlaceMapPicker](src/components/route/PlaceMapPicker.tsx)) pyta Google WYŁĄCZNIE za jawną intencją (decyzja Nat 2026-09-11):** tapnięcie w etykietę lokalu na podkładzie (`placeId` z Maps JS za darmo → proxy `action: "placeid"`, pola podstawowe, cache 7 dni w `place_details_cache`) albo „+" z wpisaną **nazwą lub adresem** (jedno `textsearch` z `latitude/longitude` = bias 3 km, kandydaci od najbliższych pinezce, mapa jedzie na pierwszy wynik - 2026-09-13). Guzik „Moja lokalizacja" ZAWSZE robi świeży odczyt GPS (`requestLocation(true, { highAccuracy: true })`) - cache z localStorage bywał z innego miasta.
6a. **Wyszukiwarka miejsc w listach/wyjazdach ([route/AddPlaceSheet](src/components/route/AddPlaceSheet.tsx), [usePlaceSearch](src/hooks/usePlaceSearch.ts), 2026-09-13):** MIASTO najpierw (`"<fraza> <miasto>"` + bias na środek: centroida miejsc listy albo geokod miasta), KRAJE tylko gdy brak miasta / kilka krajów / miasto oddało < 2 wyniki (max 2 kraje = 2 płatne zapytania), wyniki „blisko środka" na górze - kolejność, nie odsiew. ⛔ Zasięg krajowy NIE może wypierać miasta („BADI cafe Polska" dawało cukiernie z Kudowy). ⛔ NIE dodawaj rozpoznawania po postoju pinezki / przy zoomie (Nearby przy każdym przybliżeniu) - odrzucone tego samego dnia: koszt przy przeglądaniu mapy i lokale niezwiązane z celem. Miejsce ręczne (bez dopasowania) ma `address: ""`, nigdy `null` (`pins.address` NOT NULL).
7. **Biznes z własnymi zdjęciami → blokuj Google Photos (KRYTYCZNE):** Gdy lokal ma choć jedno własne zdjęcie (cover image, cover video, lub galeria `gallery_urls`), NIE pobieraj zdjęć z Google Places. Pole `businessHasOwnPhoto: boolean` w `MockPlace` (ustawiane w `enrichWithBusinessProfile`) jest źródłem prawdy — `PlaceSwiperDetail` respektuje je automatycznie. Nie nadpisuj tego zachowania bez wyraźnego powodu.

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

### Okładki wyjazdów: tylko pionowe (2026-09-13)

Okładka w eksploracji (`routes.list_cover_url`) i okładka członka (`setMyRouteCover`) muszą być **pionowe: 3:4 albo 9:16** (`COVER_MAX_RATIO = 0.8` szer/wys, [coverFormat.ts](src/lib/coverFormat.ts) - `isPortraitCover(url)` mierzy obraz po załadowaniu; brak pomiaru = NIE blokuj). Setter odrzuca panoramę toastem `toast.cover_portrait_only` ([SharedRoute](src/pages/SharedRoute.tsx) `setCoverFromGallery`/`handleSetCover`, [ReviewSummary](src/pages/ReviewSummary.tsx) `setPlanListCover`). Auto-losowanie (`ensureListCover` / `pickPortraitCover`) bierze najpierw pionowe, a gdy nie ma żadnego - dowolne (wyjazd nie może zostać bez miniatury). Stare panoramy w bazie zostają - kafelek w Eksploracji kadruje je do 9:16. Okładka hero (`cover_url`) bez ograniczeń.

**Długość wyjazdu:** `MAX_TRIP_DAYS = 92` ([tripDays.ts](src/lib/tripDays.ts)) w kreatorze i przy zmianie dat - Nat zdjęła limit 14 dni (2026-09-13), 3 miesiące zostają jako bezpiecznik; kalendarz przy długim limicie nie pokazuje „max. N dni", tylko po przycięciu zakresu wyświetla `calendar.max_range`.

### Supabase

- Klient: `src/integrations/supabase/client.ts`
- Typy: `src/integrations/supabase/types.ts` — regenerowane przez CLI, NIE edytuj ręcznie
- Migracje: `supabase/migrations/` — zawsze twórz nową migrację, NIE edytuj starych
- RLS: każda tabela musi mieć włączone Row Level Security

### Vercel Edge Functions

- Runtime: `export const config = { runtime: "edge" }`
- Lokalizacja: `api/` (root), NIE `src/api/`
- Sekretne zmienne: Vercel Dashboard → Environment Variables (bez VITE_ prefix)

### Logowanie przez Apple - trzy miejsca, ktore trzeba trzymac razem

Sign in with Apple psuje sie samo, bo **sekret klienta wygasa maksymalnie po 6 miesiacach**
(Apple odrzuca dluzszy `exp`). Nie ma po tym zadnego alertu - po prostu przestaje dzialac.

- **Sekret generujesz sam:** `node scripts/apple-client-secret.mjs --p8 <klucz.p8> --key-id <10 zn.> --team-id J33M8H3SGZ --client-id travel.trasa.signin`. Wynik wklejasz w Supabase (Authentication → Providers → Apple → Secret Key). Skrypt wypisuje date waznosci - **wpisz ja w kalendarz**.
- **Trzy identyfikatory, ktore latwo pomylic:** `travel.trasa.app` to bundle id aplikacji, `travel.trasa.signin` to **Services ID** (i to jego uzywa `external_apple_client_id` w Supabase), a `J33M8H3SGZ` to Team ID.
- **Adres powrotu zalezy od custom domain Supabase**, nie od domeny strony: Supabase wysyla do Apple `redirect_uri = https://api.spontaway.com/auth/v1/callback`. Musi byc wpisany w Services ID → Configure → Return URLs.
- **Weryfikacja domeny wymaga dzialajacego `/.well-known/`.** Regula `"/(.*)"` w `vercel.json` przepisuje WSZYSTKO na powloke aplikacji, wiec `spontaway.com/.well-known/cokolwiek` zwraca HTML landingu zamiast pliku. Plik weryfikacyjny Apple kladziemy w `public/.well-known/` - Vite kopiuje kropkowane katalogi, a Vercel serwuje istniejacy plik ZANIM zadzialaja przepisania. Ta sama luka blokuje universal links (`apple-app-site-association`).
- **Diagnoza bez urzadzenia:** `GET <supabase>/auth/v1/authorize?provider=apple&redirect_to=...` i odczytaj naglowek `Location` - widzisz dokladnie `client_id` i `redirect_uri`, ktore leca do Apple. Logi auth (`analytics/endpoints/logs.all`, tabela `auth_logs`) pokazuja, czy callback w ogole wrocil: same wpisy `/authorize` bez `/callback` znacza, ze flow umarl po stronie Apple, nie u nas.

---

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

## Gesty natywne (2026-08-28)

Apka ma zachowywać się jak natywna, więc gesty dotykowe są **wspólnymi prymitywami**, nie kopiowanym kodem per ekran. Dwa hooki:

- **[src/hooks/useDragToDismiss.ts](src/hooks/useDragToDismiss.ts)** - „przeciągnij w dół, żeby zamknąć" dla arkuszy/drawerów.
- **[src/hooks/useSwipeNav.ts](src/hooks/useSwipeNav.ts)** - „przeciągnij w bok", żeby zmienić zakładkę / krok / zdjęcie.
- **[src/hooks/useLongPress.ts](src/hooks/useLongPress.ts)** - „przytrzymaj", żeby wejść w tryb zaznaczania.
- **Haptyka** = obiekt `haptics` z [useHaptics.ts](src/hooks/useHaptics.ts). ⛔ Na iOS samo `Haptics.selectionChanged()` jest NO-OPem (plugin tworzy generator dopiero w `selectionStart()`), więc `haptics.selection()` robi pełną sekwencję start → changed → end (do 2026-09-13 ten „tick" nigdzie nie działał). Delikatne potwierdzenie = `haptics.light()`.
- **[src/hooks/useLongPressReorder.tsx](src/hooks/useLongPressReorder.tsx)** - „przytrzymaj i przestaw": zmiana kolejności kafelków palcem (okładki Wspomnień na profilu). Duch = klon DOM w portalu `fixed`, sąsiedzi = FLIP przez Web Animations API, na czas gestu NIEpasywny `touchmove` z `preventDefault` na dokumencie (React-owe `onTouchMove` jest pasywne, `touch-action` nie da się zmienić w trakcie gestu). Zjada `click` po puszczeniu (na kontenerze - po przeciągnięciu klik ląduje na wspólnym przodku) i zatrzymuje `touchend`, żeby `useSwipeNav` na rodzicu nie wziął przeciągnięcia za zmianę zakładki. Obrazki w kafelkach: `draggable={false}` + `-webkit-user-drag:none` (natywny podgląd przeciągania obrazka w WKWebView udawał tę funkcję - zgłoszenie Nat 2026-09-11).

**Arkusze dolne są PŁYWAJĄCE (2026-09-11, wzór FYI):** 8 px od lewej, prawej i dołu, zaokrąglone z każdej strony promieniem **40 px** (w przybliżeniu koncentrycznie z rogiem iPhone'a odsuniętym o 8 pt; 24 px „wchodziło" w róg ekranu) - daje to sam wariant `bottom` w [sheet.tsx](src/components/ui/sheet.tsx) (`inset-x-2 bottom-2` + `rounded-[40px]` dopisane NA KOŃCU className, więc `rounded-t-3xl` z callerów nie ma znaczenia); ręczne panele (`fixed inset-0 flex items-end`) mają `w-[calc(100%-16px)] mx-2 mb-2 rounded-[40px]`. Nowy panel rób tak samo, NIE `inset-x-0 bottom-0 rounded-t-3xl`.

**Potwierdzenia (`AlertDialog`, np. „Na pewno chcesz usunąć…") wyglądają jak arkusz** (2026-09-13): [alert-dialog.tsx](src/components/ui/alert-dialog.tsx) rysuje pływający panel dołem (`inset-x-2 bottom-2`, promień 40 px, `px-6 pt-8`), tytuł i opis wyśrodkowane, akcja NAD „Anuluj", oba guziki pełnej szerokości `rounded-full h-12` (akcja destrukcyjna = `bg-destructive` z callera, Anuluj = szary secondary). NIE nadpisuj `rounded-*`/`max-w-*` na `AlertDialogContent` w callerach.

**Arkusze na `<SheetContent side="bottom">` mają gest w dół WBUDOWANY** ([src/components/ui/sheet.tsx](src/components/ui/sheet.tsx)) - nie dodawaj tam nic ręcznie. Zamknięcie idzie przez ukryty `SheetPrimitive.Close`, więc działa z każdym `open/onOpenChange`. Wyjątek awaryjny: prop `disableDragToDismiss`. Panel składany ręcznie (fixed overlay + `rounded-t-3xl`) podpinasz sam: `const { dragProps } = useDragToDismiss({ onDismiss })` i `<div {...dragProps} style={{ ...dragProps.style, maxHeight: "82dvh" }}>`.

**Nowy bottom sheet buduj na `Sheet`, nie na własnym `fixed inset-0`** - dostajesz animację wejścia/wyjścia i gest za darmo (tak przepisany został `NotificationsDrawer`).

**Zasady kolizji (ważne):**
- Gest w dół startuje tylko gdy najbliższy scrollowany rodzic jest na górze (`scrollTop <= 0`); ruch w bok albo w górę oddaje gest treści.
- Gest w bok wymaga przewagi poziomu nad pionem i odpada w kontenerze scrollowanym poziomo (pigułki, karuzele).
- **`data-no-drag`** wyłącza zamykanie przeciągnięciem w swoim poddrzewie, **`data-no-swipe`** wyłącza zmianę zakładki. Mapy ([RouteMap](src/components/RouteMap.tsx), mapa w `RouteMapSheet`) mają oba - pan po mapie nie może zamykać arkusza ani przeskakiwać zakładek. Dodawaj je do każdego nowego elementu z własnym gestem (mapa, slider, canvas).
- Podczas gestu i domykania hook wyłącza animacje CSS (`animation: none`) - inaczej `animate-in/animate-out` nadpisuje transform i panel „nie klei się" do palca.

**Cofanie gestem od krawędzi** ([useEdgeSwipeBack](src/hooks/useEdgeSwipeBack.ts), montowany raz w `App.tsx`): przeciągnięcie od **lewej krawędzi** (strefa 24px) w prawo = `navigate(-1)`, jak w natywnym iOS - WKWebView nie daje tego dla tras SPA. Gest jest ignorowany, gdy otwarty jest modal (tam zamyka się gestem w dół), gdy start jest dalej niż 24px od krawędzi (żeby nie gryzł się z gestami treści) oraz gdy nie ma historii w aplikacji (`history.state.idx === 0`) - wtedy NIC się nie dzieje, bez skoku na ekran zapasowy.

**Gdzie gesty już są:** zakładki profilu (Listy ↔ Wyjazdy, własny i publiczny), zakładki wyjazdu (Miejsca/Galeria/Mapa w `SharedRoute` i `ReviewSummary`), zakładki listy (Miejsca/Galeria), galeria fullscreen wyjazdu, hero wizytówki i karuzela wydarzeń, wszystkie bottom sheety + ręczne drawery.

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

### ⚠️ Natywka startuje z `app.html`, NIE z `index.html`

Build **celowo zamienia pliki miejscami** (`scripts/inject-landing-snapshot.mjs`): landing
z wklejoną treścią ląduje w `dist/index.html` (Vercel serwuje z niego `/`), a powłoka
aplikacji przenosi się do `dist/app.html`. Capacitor o tym nie wie - WebView zawsze otwiera
`index.html`, więc natywka dostawała **landing z gotową treścią** i pokazywała go przez
ułamek sekundy, zanim React się zamontował (zgłoszenie Nat 2026-09-08).

`npm run native:shell` (`scripts/native-shell.mjs`) podmienia `index.html` w projektach
natywnych na powłokę. Leci **PO `cap sync`**, bo sync nadpisuje `public/` świeżym `dist/`.
Jest już wpięty w `check:both` i `check:native`.

⛔ **Po ręcznym `npx cap sync ios` ZAWSZE odpal `npm run native:shell`** - inaczej landing
wraca do natywki po cichu. Skrypt sam sprawdza, czy `app.html` ma pusty `<div id="root">`
i przerywa, gdyby build przestał ją opróżniać.

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
- ~~`qrcode.react`~~ — UŻYWANE od 2026-09-10 (kod QR do TestFlight w [ReferralCard](src/components/profile/ReferralCard.tsx)), NIE usuwać
- `canvas-confetti` — 0 użyć w kodzie
- `recharts` (poza ikonką z lucide) — komponent chart.tsx istnieje ale nikt go nie importuje
- `embla-carousel-react` — carousel.tsx istnieje ale nie jest używany na stronach
- `react-resizable-panels` — resizable.tsx istnieje ale nie jest używany

---

## Konwencje kodowania

- **Język UI:** Polski (komunikaty, etykiety, placeholdery)
- **Język kodu:** Angielski (zmienne, funkcje, komentarze)
- **Styl komponentów:** Tailwind CSS, bez CSS Modules ani styled-components
- **Ikony:** Lucide React (`lucide-react`) - bez innych bibliotek ikon. **Brandowe SVG** (`public/Ikona_*.svg`, rysunki Nat) rysuj przez [BrandIcon](src/components/BrandIcon.tsx) (CSS mask + `currentColor`, kolor z klasy tekstu jak w lucide). Zestaw (2026-09-11): `Ikona_Home`, `Ikona_Eksploracja`, `Ikona_Miejsca`, `Ikona_Profil` (dolny pasek), `Ikona_Trasy` (znak wyjazdu/placeholder), `Ikona_Zapisane`, `Ikona_Gwiazdka` (**gwiazdka „topki"** przy miejscu, w menu i w animacji - NIE lucide `Star`), `Ikona_Listy_Listy` (**wypełniona ikona list** = `LIST_ICON`: zakładka Listy na profilu, kafelki list w eksploracji, kategoria „Listy" w wyszukiwarce - NIE lucide `FileText`/`LayoutGrid`), `Ikona__*` (kategorie miejsc).
- **⛔ ZAKAZ długich myślników (—, em dash):** Nigdy nie używaj znaku `—` w żadnym tekście UI (banery, hinty, placeholdery, etykiety, komunikaty). Zamiast tego używaj zwykłego myślnika `-`, dwukropka `:`, przecinka lub przeformułuj zdanie.
- **⛔ ZAKAZ EMOJI w UI:** Nigdy nie dodawaj emoji (🍽️ ☕ 🌳 🏰 📍 itp.) do żadnego elementu interfejsu: placeholderów zdjęć/miniaturek, badge'ów kategorii, kart, list, etykiet, komunikatów, pustych stanów. Zamiast emoji kategorii używaj **ikon SVG** (`public/Ikona__*.svg` przez helper `categoryIconSrc()` z `src/lib/placeCategoryIcon.ts`) na peachy tle `#fcede3` (fallback zdjęcia miejsca = `PlacePhoto`). Dotyczy to nowych i istniejących widoków. Wyjątek: emoji w flagach/oznaczeniach czysto tekstowych bez alternatywy (np. 🇵🇱 w tej dokumentacji) - ale w UI aplikacji NIE.
- **🇵🇱 Polskie sieroty (typography rule, OBOWIĄZKOWE):** Pojedyncze litery `a, i, o, u, w, z` (oraz krótkie `do, na, po, za, ze, od` jeśli to możliwe) NIGDY nie mogą kończyć linii. Po nich zawsze musi być **twarda spacja** (non-breaking space, ` ` / NBSP / U+00A0), żeby przeniosły się do następnej linii razem z kolejnym słowem.
  - **Dotyczy:** wszystkie teksty UI w aplikacji i na stronach marketingowych (nagłówki, opisy, etykiety, placeholdery, treści maili, modale, toasty).
  - **W JSX:** używaj template literal z escape, np. `` {`treść z przyjaciółmi i grupą`} ``, albo inline `{" "}` w miejscach z elementami HTML w środku.
  - **Jak rozpoznać:** czytaj zdanie i znajduj pojedyncze litery przed spacją - tam wstaw NBSP. Przykład: `"z miastem"` → `"z miastem"`, `"i wam"` → `"i wam"`.
- **🌍 DWA JĘZYKI OD RAZU (2026-09-06, OBOWIĄZKOWE):** Idziemy z apką globalnie, więc **każdy nowy widok powstaje po polsku I po angielsku w tym samym commicie**. Napisy żyją w `src/locales/pl/*.json` + `src/locales/en/*.json` i lecą przez `t()`. ⛔ **ZAKAZ** polskiego tekstu wprost w JSX oraz zapasowego polskiego w wywołaniu (`t("klucz", "Polski")` / `defaultValue: "Polski"`) - to działa po polsku, a po angielsku pokazuje polski, bo `fallbackLng` to `pl`. Bramka: `npm run i18n:check` (wpięta w `check:both`) pilnuje parzystości kluczy, form liczby mnogiej i braku polskiego na sztywno. Pliki z długiem sprzed bramki są w `scripts/i18n-baseline.json` - **ta lista może tylko maleć**, dopisanie nowego pliku to błąd.
  - **Liczba mnoga:** polski ma `_one` / `_few` / `_many`, angielski `_one` / `_other`. Nie kopiuj polskich sufiksów do `en/*.json` - `_few` i `_many` nigdy się po angielsku nie dopasują.
  - **Twarde spacje (sieroty) to reguła POLSKA** - tekstów EN nie NBSP-ujemy.
  - **Treści użytkowników** (nazwy tras, notki, tytuły list) NIE są tłumaczone - to co człowiek napisał, zostaje jak napisał.
  - **Panel ops (`src/admin/**`) zostaje po polsku** - widzą go tylko founderzy (decyzja Nat 2026-09-06).
- **Toast:** Sonner (`import { toast } from "sonner"`). **U GÓRY ekranu jako biała pigułka** (2026-09-11, wzór Pinterest), akcja (`action: { label: "Cofnij" | "Zobacz" }`) = mała CIEMNA pigułka po prawej; NIE ustawiaj `position` per wywołanie.
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
