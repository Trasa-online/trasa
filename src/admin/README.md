# Panel ops (`admin.spontaway.com`)

Dokumentacja panelu żyje TUTAJ, a nie w `CLAUDE.md`, bo `CLAUDE.md` jest wspólny dla
wszystkich gałęzi, a panel buduje się wyłącznie z gałęzi `admin`. Jedna linijka
odsyłacza w `CLAUDE.md` należy do `main` - dopisz ją tam, nie tutaj.

Kierunek wizualny: **„Karta danych"** (wybór Nat, 15.09.2026) + tryb ciemny.

---

## 1. Nawigacja

Jedenaście płaskich pozycji zeszło do czterech grup. Grupa niesie znaczenie: czy to
jest praca do zrobienia, czy tylko podgląd.

| Grupa | Pozycje |
|---|---|
| (bez nazwy) | Dziś `/`, Kolejka `/kolejka` (licznik spraw) |
| Dane | Użytkownicy `/users`, Miejsca `/miejsca`, Wizytówki `/wizytowki`, Leady `/zestawienia` |
| Liczby | Analityka `/analityka`, Koszty API `/koszty` |
| System | Audyt `/audyt`, Ustawienia `/ustawienia` |

**Moderacja nie ma już własnych adresów.** `/moderacja/b2c`, `/moderacja/b2b`, `/flagi`
i `/ops` to teraz FILTRY jednej kolejki (`/kolejka?typ=…`), bo to ta sama czynność:
spójrz, zdecyduj, następna. Stare adresy zostały jako przekierowania z ustawionym
filtrem - zakładki w przeglądarce i linki w mailach mają dalej działać.

Filtry kolejki: `zdjecia`, `zgloszenia`, `kolekcje`, `wizytowki`, `wyjazdy`, `flagi`, `bledy`.

⌘K / Ctrl+K otwiera paletę skoków ([CommandPalette](layout/CommandPalette.tsx)) do modułu
albo filtra kolejki. Do 15.09.2026 w belce stała atrapa tego pola z podpowiedzią skrótu,
który nic nie robił.

---

## 2. Tokeny

**[ui/tokens.css](ui/tokens.css) to JEDYNE miejsce z wartościami koloru, promienia i cienia.**
Moduł nie definiuje własnych kolorów; brakuje czegoś - dokładasz token tam.

Nazwa zmiennej mówi DO CZEGO służy, nigdy jakim jest kolorem - dlatego zmiana trybu to
podmiana wartości, a nie przepisywanie komponentów.

```
--canvas --surface --photo --ink --graphite --stone --line
--accent --on-accent --console --console-ink
--ok --ok-bg --warn --warn-bg --bad --bad-bg --brand-yellow
--r-control (6px) --r-card (12px) --shell-width (1160px) --font-data --shadow-inset
```

**Pomarańcz `--accent` wolno użyć w DOKŁADNIE czterech miejscach:** guzik primary,
aktywna pozycja nawigacji, aktywny chip filtra, obrys fokusa. Jeśli wejdzie na plakietki
statusu, kierunek się rozsypuje - status niesie kolor semantyczny (`ok`/`warn`/`bad`).

**Żółty marki** (`--brand-yellow`) to jedno miejsce: znak „S" w belce.

**Monospace (`.data`) jest dla DANYCH:** liczby, kwoty, uuid, znaczniki czasu, kody
statusów, JSON. Nie dla zdań i nie dla etykiet interfejsu - te zostają w Interze.

### Tryb ciemny

⛔ Zakaz ciemnych teł z `CLAUDE.md` dotyczy stron WIDOCZNYCH DLA UŻYTKOWNIKÓW. Panel ops
to narzędzie wewnętrzne za bramką roli i 2FA - **to jest świadomy wyjątek**, zapisany tu
na stałe (decyzja Nat, 15.09.2026: „gdybyśmy pracowali wieczorami czy w nocy").

Tryb wybiera się w Ustawieniach → Wygląd panelu (`system` / `light` / `dark`, klucz
localStorage `ops_theme`, [ui/theme.ts](ui/theme.ts)). `system` zdejmuje atrybut i oddaje
decyzję `prefers-color-scheme`.

⚠️ **`--photo` jest w ciemnym trybie JAŚNIEJSZY niż `--surface`.** To nie pomyłka: ocena
ekspozycji zdjęcia w kwarantannie nie może zależeć od tego, czy operatorka pracuje w dzień
czy w nocy. Miniatury i podglądy zdjęć siedzą na `--photo`, nie na `--surface`.

---

## 3. Prymitywy

**Nowy ekran w panelu = prymitywy z [`src/admin/ui/`](ui/).** Moduł nie stylizuje niczego
lokalnie - to jest warunek, żeby niespójność nie wróciła za miesiąc.

| Prymityw | Do czego |
|---|---|
| `AppShell` | jedna szerokość treści dla całego panelu (wcześniej żyły trzy różne `max-w-*`) |
| `PageHeader` | tytuł + podtytuł + akcje |
| `Section` | nagłówek sekcji wewnątrz strony |
| `Toolbar` | szukanie, filtry, licznik |
| `FilterChips` | chipy filtrów (poziome przewijanie na telefonie) |
| `DataTable` | tabela na `md+`, **karty rekordów poniżej `md`** z tego samego zestawu kolumn |
| `QueueRow` | wiersz kolejki |
| `Card` | karta sprawy |
| `Metric` | jedna liczba z etykietą |
| `Bar` | pasek udziału / zużycia |
| `StatusBadge` | plakietka statusu (`neutral`/`ok`/`warn`/`bad`) |
| `Button` | `primary` / `ghost` / `danger` |
| `TextField`, `TextArea`, `Select` | pola formularzy |
| `Panel` | okno szczegółów (arkusz od dołu poniżej `sm`) |
| `ConfirmDialog` | potwierdzenie akcji nieodwracalnej |
| `EmptyState` | pusty stan |
| `Loading`, `Spinner` | jedyna animacja ładowania w panelu |

### Dwie reguły treści

1. **Pusty stan mówi DWIE rzeczy: co jest faktem i co z tym zrobić.**
   ⛔ NIE „Brak rozpatrzonych." - takie zdanie nie pomaga nikomu.
2. **Potwierdzenie NAZYWA SKUTEK, nie pyta „na pewno?".**
   Wzór: „Usuniesz konto @kasia. Profil, kolekcje i wyjazdy znikną z aplikacji."

### Mobile

`DataTable` poniżej `md` nie zwęża tabeli, tylko **zmienia postać na karty rekordów**.
Siedem kolumn na 390 px dałoby przewijanie w poziomie, a robota polega na skanowaniu
wzrokiem i decydowaniu - przewijanie w bok ją zabija.

---

## 4. Podglądy „jak w apce"

`src/admin/modules/preview/` odpowiada na jedno pytanie: **co dokładnie widzi użytkownik**.
Dlatego podglądy celowo wyglądają jak aplikacja, nie jak panel - proporcje zdjęć, chipy
kategorii i dymki notek są takie, jak w apce (patrz `CLAUDE.md`, sekcja o proporcjach).

| Podgląd | Co pokazuje | Skąd się otwiera |
|---|---|---|
| `CollectionPreview` | pasek w kolorze kolekcji, autor, chipy, wszystkie miejsca z miniaturami i notkami | Dziś (wiersz „Ostatnio dodane"), Kolejka → Kolekcje („Podgląd") |
| `TripPreview` | okładka, autor, opis właściciela, notki uczestników, miejsca **po dniach** ze zdjęciami | Dziś, Kolejka → Wyjazdy |
| `BusinessPreview` | okładka 4:3, logo, kategorie, adres, godziny, opis, galeria + **kontakt do lokalu** | Wizytówki (wiersz), Kolejka → Wizytówki („Podgląd") |

Zasady:

- **Kliknięcie w zdjęcie w podglądzie kolekcji i wyjazdu otwiera moderację tego zdjęcia.**
  Podgląd jest narzędziem pracy, więc nie każe przechodzić gdzie indziej, żeby coś z nim
  zrobić. Do moderacji leci ORYGINALNA wartość z bazy, nie rozwiązany link - RPC dopasowuje
  zdjęcie po wartości.
- ⚠️ **Zdjęcia w panelu idą przez proxy na GŁÓWNEJ domenie** (`previewPhoto` →
  `adminPhotoUrl`): `admin.spontaway.com` nie ma `/api/place-photo`, więc `resolveStored`
  z aplikacji zwraca tu martwy link. Nie używaj `resolveStored` w `src/admin`.
- Dane ładują się **dopiero po otwarciu arkusza** (`enabled: !!id`), nie przy każdej liście.

### Kontakt z lokalem

Sekcja „Kontakt" w `BusinessPreview` daje to, czym lokal faktycznie da się złapać: mail
(z gotowym tematem i wstępem), telefon i stronę, każdy z kopiowaniem do schowka.

⛔ **Nie ma tu okienka czatu.** Czat jest zaprojektowany w nowym dashboardzie B2B, ale po
stronie lokalu jeszcze nie istnieje - wiadomość nie miałaby gdzie dojść. Gdy czat wejdzie
(tabela wątków + widok w panelu lokalu), wchodzi w to samo miejsce, nad listą kanałów.

---

## 5. Leady i kontakt do lokalu

Zakładka Leady pokazuje miejsca, które użytkownicy dodają do kolekcji i wyjazdów, a które
nie mają jeszcze konta w spontaway. Wejście w wiersz otwiera panel kontaktu:

- **„Znajdź kontakt"** (edge `lead-contact-lookup`) pyta Google o stronę i telefon,
  a potem wchodzi na stronę lokalu i szuka adresu e-mail w `mailto:` oraz na podstronach
  `/kontakt`, `/contact`, `/o-nas`. Wynik ląduje w tabeli `lead_contacts`.
- Adres można **poprawić ręcznie** (`found_by = 'manual'`) i dopisać notatkę, a lead
  oznaczyć jako „wysłana oferta".

⚠️ **Google Places NIE zwraca adresów e-mail.** Ma stronę i telefon, i tyle. Mail bierze się
wyłącznie ze strony lokalu, więc skuteczność jest ograniczona z natury. Próba na 20
najczęściej dodawanych leadach (15.09.2026):

| co znaleziono | ile z 20 |
|---|---|
| telefon | 15 |
| własna strona | 9 |
| **adres e-mail** | **5** |
| tylko Instagram | 3 |
| nic | 5 |

To jest normalny wynik w gastronomii, nie awaria wyszukiwania. Dlatego panel pokazuje
telefon na równi z mailem i pozwala wpisać adres ręcznie.

Dwie rzeczy zapisane na stałe:

- ⛔ **Wysyłki ofert w panelu NIE MA** (decyzja Nat 15.09.2026): panel znajduje kontakt,
  ofertę wysyła Nat ze swojej skrzynki. „Napisz maila" otwiera zwykły `mailto:`, więc nic
  nie wychodzi bez kliknięcia w kliencie poczty. Gdyby wysyłka kiedyś weszła do panelu,
  ma lecieć z **osobnej subdomeny** (np. `wspolpraca.spontaway.com`), żeby zgłoszenia spamu
  nie ciągnęły w dół dostarczalności resetów haseł i maili powitalnych.
- ⚠️ Nasz `User-Agent` NIE zawiera adresu e-mail: pierwszy testowany lokal wypisywał
  User-Agent na stronie, więc nasz własny adres wracał jako „znaleziony kontakt lokalu".
  Kandydaci z naszych domen są dodatkowo odfiltrowani.

Każde kliknięcie „Znajdź kontakt" to **dwa płatne zapytania do Google**, dlatego działa
pojedynczo, na żądanie, i zapisuje wynik w bazie - drugi raz ten sam lokal jest za darmo.

---

## 6. Czego nie ruszać

- logiki `RequireAdmin.tsx`, `RequireTier.tsx`, `AdminMfaGate.tsx` (bramka roli + 2FA,
  fail-closed - warstwa wizualna jest na tokenach, logika zostaje),
- hooków danych (`use*.ts`) i mutacji moderacji,
- RLS i funkcji SECURITY DEFINER,
- ikony panelu (odwrócone kolory wobec ikony apki - patrz `CLAUDE.md`),
- aplikacji B2C.

**Panel jest po polsku i nie ma i18n.** ⛔ Żadnego `i18next`, żadnego `src/locales/*/admin.json` -
widzą go tylko founderzy (decyzja Nat 2026-09-06).

---

## 7. Co zostało do zrobienia

- **Wspólny strumień kolejki.** Dziś chip wybiera ŹRÓDŁO i renderuje jego panel. Jedna
  lista wszystkich typów naraz wymaga hooka łączącego siedem zapytań i wspólnego kształtu
  sprawy - wchodzi osobno. Nic z funkcjonalności na tym nie ucierpiało.
- **Skróty klawiaturowe `J` / `K` / `A` / `H` / `Backspace` / `?`** w kolejce. Potrzebują
  kursora nad jednym strumieniem, więc czekają na punkt wyżej. `⌘K` działa już teraz.
- **„Czas najstarszej nieroz­patrzonej sprawy"** na stronie głównej. `useAdminPending`
  zwraca same liczniki - świadomie nie podstawiam tam wartości, której nie mam.
- **Czat z lokalem** w `BusinessPreview` - czeka na stronę biznesową (patrz sekcja 4).
- **Zdjęcia miejsc**: 887 z 994 aktywnych miejsc nie ma `places.photo_url`. Panel pokazuje
  wtedy zdjęcie użytkownika albo ikonę kategorii, a pojedyncze miejsce da się uzupełnić
  guzikiem „Pobierz zdjęcie z Google". Masowego backfillu świadomie nie ma - to płatne
  wywołanie razy 887.
