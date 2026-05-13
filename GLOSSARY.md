# GLOSSARY — twoja ściąga pojęć

> Słownik dla product designerki pracującej z kodem + AI + terminalem.
> Po polsku, bez bullshitu, z konkretnymi przykładami z naszego projektu.

---

## Jak tego używać

**Codziennie:**
- Otwórz w VS Code (Cmd+P → wpisz "GLOSSARY") lub na GitHubie
- Szukaj przez Cmd+F (Mac) lub Ctrl+F (Windows) - wpisz pojęcie którego nie rozumiesz

**Z AI:**
- Wklej fragment kodu / komendy i powiedz: *"wyjaśnij używając pojęć z GLOSSARY.md"*
- Albo: *"czego z GLOSSARY mi brakuje żeby zrozumieć tę komendę?"*
- Jeśli AI używa pojęcia którego tu nie ma → poproś żeby je dopisał do glossary

**Rozszerzaj go:**
- Każde nowe pojęcie którego się uczysz - dopisz tutaj
- Format: nazwa, jednolinijkowe wyjaśnienie, przykład z naszego projektu, sygnał ostrzegawczy (jeśli jest)
- Nie musisz pisać "ładnie" - to twoja ściąga, nie publikacja

**Sygnały po prawej (legenda):**
- 🟢 = bezpieczne pojęcie, nic nie zepsujesz
- 🟡 = uważaj, niektóre warianty mogą coś zmienić
- 🔴 = potencjalnie destrukcyjne, pytaj zanim odpalisz

---

## 📁 Terminal / CLI

### `cd` 🟢
"Change directory" - przejdź do folderu.
```bash
cd ~/trasa            # wejdź do projektu (~ = twój folder domowy)
cd ..                 # wyjdź jeden folder wyżej
cd /                  # idź do roota systemu (rzadko potrzebne)
```

### `ls` 🟢
"List" - pokaż pliki w folderze.
```bash
ls                    # zwykła lista
ls -la                # pokaż też ukryte pliki (.env, .gitignore itd.)
```

### `pwd` 🟢
"Print working directory" - gdzie aktualnie jestem? Pomocne gdy się zgubisz w terminalu.

### `cat plik.txt` 🟢
Wyświetl zawartość pliku na ekranie. Lepiej używać Read w VS Code dla większych plików.

### `npm run <coś>` 🟡
Uruchamia skrypt zdefiniowany w `package.json`. Jakie skrypty masz - zobacz w `package.json` w sekcji `"scripts"`.
```bash
npm run dev                # uruchom lokalny serwer
npm run build              # zbuduj produkcję
npm run backfill:photos    # nasz skrypt do cache zdjęć
```

### `npx <coś>` 🟡
Jak `npm` ale **uruchamia programy bez instalacji**. Pobiera, używa raz, zapomina.
```bash
npx tsx scripts/backfill-photo-cache.ts   # uruchom TypeScript bez instalowania tsx
```

### `--dry-run` 🟢
"Próba na sucho" - skrypt pokazuje co BY zrobił, ale nic nie robi. Zawsze używaj przed pierwszym uruchomieniem nowego skryptu.

### `--help` 🟢
Pokaż instrukcję komendy. Pierwsza rzecz do wpisania gdy nie wiesz jak coś działa.
```bash
git --help
npm --help
supabase --help
```

### `|` (pipe) 🟢
"Weź output jednej komendy i wrzuć go do drugiej." Tworzy łańcuch.
```bash
ls | grep "test"      # wylistuj pliki | przefiltruj te ze słowem "test"
cat plik.log | tail -5 # zawartość pliku | tylko ostatnie 5 linii
```

### `&&` 🟢
"Wykonaj kolejną komendę TYLKO jeśli poprzednia się udała."
```bash
npm install && npm run build   # zainstaluj zależności, JEŚLI ok to zbuduj
```

### `>` i `>>` 🟡
- `>` = zapisz output do pliku (nadpisuje!)
- `>>` = dopisz na koniec pliku
```bash
ls > pliki.txt        # zapis listy do pliku (nadpisuje istniejący!)
echo "tekst" >> log.txt # dopisanie do loga
```

### `2>&1` 🟢
"Pokaż mi też błędy razem ze zwykłym outputem." `2` = stderr, `1` = stdout, `2>&1` = przekieruj stderr do stdout.

### `tail -n` i `head -n` 🟢
"Pokaż ostatnie/pierwsze N linii."
```bash
tail -10 plik.log     # ostatnie 10 linii
head -5 plik.log      # pierwsze 5 linii
```

### `set -a` / `set +a` 🟡
Tryby shella. `set -a` = "od teraz auto-eksportuj zmienne". `set +a` = wyłącz. Używane razem z `. ./.env` żeby załadować sekrety.

### `. ./.env` (source) 🟡
Wczytaj plik (kropka na początku = "source"). Wykonuje zawartość pliku w bieżącym shellu. Inaczej niż uruchomienie skryptu - zmiany zostają w twoim terminalu.

### `rm` 🔴
DELETE. "Remove." Usuwa pliki. **Niebezpieczne, bez kosza.**
```bash
rm plik.txt           # usuń plik
rm -rf folder/        # usuń folder i wszystko w nim (NIEODWRACALNE)
```
**Zawsze pytaj AI zanim użyjesz `rm -rf`.**

---

## 🌿 Git

### `git status` 🟢
"Co się zmieniło od ostatniego commita?" Twoja **pierwsza komenda** zawsze gdy nie wiesz co się dzieje.

### `git diff` 🟢
Pokaż konkretnie KTÓRE LINIE się zmieniły. Bez argumentów = unstaged changes. Z `--cached` = staged.

### `git add <plik>` 🟢
"Przygotuj ten plik do commita." Plik wchodzi w stan "staged".
```bash
git add plik.tsx              # dodaj jeden plik
git add .                     # dodaj WSZYSTKO (uważaj - może wciągnąć .env!)
```

### `git commit -m "wiadomość"` 🟡
"Zapisz zmiany jako jeden punkt w historii." To jak save w grze.
```bash
git commit -m "fix: naprawiony bug w formularzu"
```

### `git push` 🟡
"Wyślij moje commity na serwer (GitHub)." Dopiero TUTAJ zmiany stają się publiczne dla zespołu.

### `git pull` 🟡
"Ściągnij zmiany od innych z serwera." Może wymagać rozwiązywania konfliktów.

### `git branch` 🟢
"Pokaż listę gałęzi" lub "stwórz nową gałąź."
```bash
git branch                    # lista gałęzi
git branch nowa-funkcja       # nowa gałąź (nie przełącza)
git checkout -b nowa-funkcja  # nowa gałąź + przełącz na nią
```

### `git log --oneline -5` 🟢
"Pokaż ostatnie 5 commitów, po jednej linii." Świetne do orientacji co się działo.

### `git stash` 🟡
"Schowaj moje zmiany na bok, nie commituj." Przydaje się gdy musisz przełączyć branche.
```bash
git stash                     # schowaj
git stash pop                 # przywróć ostatnio schowane
```

### `--force` / `-f` 🔴
"Wymuś" - dla operacji destrukcyjnych. **Nigdy nie używaj bez wyraźnej potrzeby.**

### `git reset --hard` 🔴
"Wymaż wszystkie niezacommitowane zmiany." Cofa stan plików do ostatniego commita. **Nieodwracalne.**

---

## 💻 Kod

### TypeScript (`.ts`, `.tsx`) 🟢
Wersja JavaScriptu z typami. `.tsx` = TypeScript + JSX (czyli z komponentami Reacta). Przed wypuszczeniem jest "kompilowany" do zwykłego JS.

### `import` / `export` 🟢
Łącza między plikami.
```typescript
// W pliku A:
export function pomocnik() { ... }

// W pliku B:
import { pomocnik } from "./A";
```

### `async` / `await` 🟢
"Poczekaj aż coś się skończy zanim zrobisz dalej." Używane przy operacjach które trwają (fetch, baza, plik).
```typescript
async function pobierzDane() {
  const wynik = await fetch("/api/cos");   // czekaj na odpowiedź
  return wynik.json();
}
```

### `useEffect`, `useState` (React Hooks) 🟢
- `useState` = pamięć komponentu ("co user wpisał w polu")
- `useEffect` = "zrób coś gdy komponent się pokaże/zmieni"

### `null` / `undefined` 🟢
- `null` = "celowo nic"
- `undefined` = "nie ma takiej wartości"

W praktyce traktujesz prawie tak samo - jako "brak danych".

### `const` / `let` 🟢
- `const` = stała (nie zmienisz po przypisaniu)
- `let` = zmienna (można zmieniać)

### Funkcja vs zmienna 🟢
- Zmienna trzyma wartość (`const x = 5`)
- Funkcja to mini-program (`function dodaj(a, b) { return a + b }`)

### Komponent (React) 🟢
Klocek UI - funkcja która zwraca kawałek interfejsu. W naszym projekcie pliki w `src/components/`.

### `props` (właściwości) 🟢
Argumenty komponentu - co rodzic mu przekazuje.
```tsx
<PinThumb pin={mojPin} onClick={moja Funkcja} />
//        ^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^
//        props        props
```

---

## 🌐 Web / HTTP

### HTTP request / response 🟢
Rozmowa między przeglądarką a serwerem. Przeglądarka wysyła "request" (prośbę), serwer odsyła "response" (odpowiedź).

### Statusy HTTP 🟢
| Kod | Co znaczy |
|---|---|
| **200** | OK, wszystko działa |
| **201** | OK, coś utworzyłem |
| **301/302** | Przekierowanie |
| **400** | Bad request - źle wysłałaś |
| **401** | Brak autoryzacji (nie zalogowano) |
| **403** | Forbidden - zalogowano ale brak uprawnień |
| **404** | Not found - nie ma takiego zasobu |
| **429** | Za dużo requestów (rate limit) |
| **500** | Server error - serwer się wykrzaczył |
| **502/503/504** | Coś z infrastrukturą serwera |

### GET / POST / PUT / DELETE 🟢
Typy requestów (metody HTTP):
- **GET** = pobierz dane (czytanie)
- **POST** = wyślij dane do utworzenia czegoś
- **PUT** / **PATCH** = aktualizacja istniejącego
- **DELETE** = usunięcie

### JSON 🟢
Format danych w formie tekstowej. Wygląda tak:
```json
{
  "nazwa": "Hala Koszyki",
  "miasto": "Warszawa",
  "ocena": 4.5,
  "tagi": ["restauracja", "food hall"]
}
```

### API 🟢
"Application Programming Interface" - sposób komunikacji jednego programu z drugim. Np. nasz frontend rozmawia z Supabase API.

### CORS 🟡
"Cross-Origin Resource Sharing" - regulamin który przeglądarki egzekwują: kto może mówić do kogo. Gdy widzisz błąd "CORS error" to znaczy że serwer nie zezwala na request z twojej domeny.

### CDN 🟢
"Content Delivery Network" - sieć serwerów rozsianych po świecie, blisko userów. Pliki (zdjęcia, JS) są dystrybuowane przez CDN żeby ładowały się szybciej. Vercel, Cloudflare, Supabase Storage - wszyscy mają CDN.

### Cache 🟢
"Pamięć podręczna." Zapisywanie wyniku na przyszłość, żeby drugi raz nie liczyć/pobierać. Może być po stronie przeglądarki, CDN, serwera, bazy danych.

---

## 🗄️ Database (Supabase)

### Tabela / wiersz / kolumna 🟢
Jak w Excelu:
- **Tabela** = arkusz (np. `places`)
- **Kolumna** = nagłówek (np. `place_name`, `city`)
- **Wiersz** = pojedynczy rekord (np. "Hala Koszyki | Warszawa | restauracja")

### Primary key / foreign key 🟢
- **Primary key** = unikalny identyfikator wiersza (najczęściej `id` z UUID)
- **Foreign key** = wskaźnik do wiersza w innej tabeli (np. `pins.route_id` wskazuje na `routes.id`)

### UUID 🟢
Long random ID, np. `f8da2794-83d3-4801-a74d-68084eb07e91`. Praktycznie niemożliwy do zdublowania.

### Migracja (migration) 🟡
Plik SQL który modyfikuje strukturę bazy (dodaje tabelę, kolumnę, index). Pliki w `supabase/migrations/`. Numerowane datami, **wykonują się raz**, nie edytuj starych - twórz nowe.

### SQL 🟢
Język do gadania z bazą. Najważniejsze polecenia:
```sql
SELECT * FROM places WHERE city = 'Warszawa';   -- czytaj
INSERT INTO places (city, place_name) VALUES ('Warszawa', 'Hala Koszyki');  -- dodaj
UPDATE places SET rating = 4.7 WHERE id = '...';  -- zmień
DELETE FROM places WHERE id = '...';               -- usuń (uważaj!)
```

### RLS (Row Level Security) 🟡
Supabase'owa funkcja: kto może czytać/zmieniać które wiersze. Każda nowa tabela powinna mieć RLS włączone.

### Service role key 🔴
Klucz Supabase który **omija RLS** - daje dostęp do wszystkiego. **Tylko server-side, NIGDY w kodzie frontend, NIGDY w git.** Pliki `.env`, secrets w Supabase Dashboard. To jest ten klucz w twoim `.env`.

### Anon key 🟢
Publiczny klucz Supabase, OK do udostępnienia. Frontend go używa. Respektuje RLS.

### Index 🟢
"Spis treści" dla tabeli. Przyspiesza queries WHERE i ORDER BY. Tworzony przez `CREATE INDEX`.

---

## ☁️ DevOps / Deploy

### Edge function 🟡
Funkcja serwerowa, uruchamiana "na krawędzi" (blisko usera). U nas: pliki w `supabase/functions/` napisane w Deno. Każda ma `index.ts` jako entry point.
```bash
supabase functions deploy nazwa-funkcji  # wgranie na serwer
```

### Deploy 🟡
"Wgranie kodu na serwer/produkcję." Może być automatyczne (CI/CD) lub ręczne.

### Vercel 🟢
Hosting frontend (sam app trasa.travel). Auto-deploy przy każdym pushu na `main`.

### Supabase 🟡
Baza + auth + storage + edge functions w jednym. Nasza chmura backendowa.

### CI/CD 🟢
"Continuous Integration / Continuous Deployment" - automatyzacja testów i deployu. Np. push na GitHub → Vercel automatycznie buduje i wrzuca na produkcję.

### Build vs runtime 🟢
- **Build** = składanie aplikacji w paczkę (`npm run build`)
- **Runtime** = jak aplikacja działa po uruchomieniu (w przeglądarce / na serwerze)

### Production vs Development 🟡
- **Development** (dev) = lokalnie, twój komputer, `npm run dev`
- **Production** (prod) = co widzą userzy, deployowane na Vercel

### Rollback 🟢
"Cofnięcie deployu" do poprzedniej wersji. Na Vercel jeden klik w dashboardzie.

---

## 🔐 Pliki / Konfiguracja / Sekrety

### `.env` 🔴
Plik z sekretnymi kluczami. **NIGDY nie commituj.** Jest w `.gitignore`. Lokalnie OK.

### `.env.example` 🟢
Szablon pliku `.env` ale BEZ prawdziwych wartości (z placeholders). Commitowany do repo żeby zespół wiedział jakie zmienne potrzebuje ustawić.

### Environment variable (env var, zmienna środowiskowa) 🟡
Wartość ustawiana poza kodem - inaczej w dev, inaczej w prod, inaczej u różnych userów. Np. `GOOGLE_MAPS_API_KEY`.

### `.gitignore` 🟢
Lista plików/folderów które git ma ignorować (nie commitować). U nas: `.env`, `node_modules`, `dist`.

### `package.json` 🟢
"Manifest" projektu Node/React. Zawiera:
- `dependencies` = paczki potrzebne aplikacji
- `devDependencies` = paczki potrzebne tylko do developmentu
- `scripts` = komendy które można uruchamiać przez `npm run`

### `package-lock.json` / `pnpm-lock.yaml` 🟢
Lockfile - dokładne wersje zależności. **NIE EDYTOWAĆ ręcznie**, ale commitujemy do repo.

### `node_modules/` 🟢
Folder z pobranymi paczkami. Wielki (setki MB), **nigdy nie commitowany** (w `.gitignore`). Tworzony przez `npm install`.

### `tsconfig.json` 🟢
Konfiguracja TypeScript - jak strict typowanie, jakie pliki kompilować itd.

### YAML / TOML 🟢
Formaty configów. YAML: spacje, lista dwukropków. TOML: jak `.ini`, sekcje w `[nawiasach]`. Nasz `supabase/config.toml` to TOML.

---

## 🛠️ Narzędzia w naszym projekcie

### Vite 🟢
Bundler/dev server dla frontend. `npm run dev` go uruchamia, `npm run build` go używa do produkcji.

### Tailwind 🟢
CSS framework. Klasy CSS jako "atomy" - `bg-orange-600`, `rounded-2xl`, `flex` itd. zamiast pisania własnego CSS-a.

### React 🟢
Biblioteka do UI. Komponenty + state + props.

### Supabase client 🟡
JavaScript SDK do gadania z Supabase. U nas w `src/integrations/supabase/client.ts`.
```typescript
const { data, error } = await supabase
  .from("places")
  .select("*")
  .eq("city", "Warszawa");
```

### shadcn/ui 🟢
Biblioteka komponentów UI (Button, Sheet, Drawer itp.). Pliki w `src/components/ui/`.

### Deno 🟡
Środowisko jak Node.js, ale dla Supabase Edge Functions. Inne importy (`https://esm.sh/...` zamiast `npm`).

### PostHog 🟢
Analytics - tracking eventów (np. `place_viewed`). Wywołania `posthog.capture(...)`.

### Resend 🟢
Wysyłanie emaili z aplikacji. U nas używane do alertów waitlist i monitoring progu.

---

## 🤖 Praca z AI (Claude Code)

### Prompt 🟢
Twoja wiadomość do AI. Im bardziej konkretny, tym lepsza odpowiedź.

### Context (kontekst) 🟢
"Co AI pamięta z tej rozmowy." Każda rozmowa ma ograniczenie - przy długich automatycznie streszcza starsze.

### Plan mode 🟢
Tryb gdzie AI planuje zmiany ale nic nie wykonuje. Idealny gdy chcesz omówić podejście przed implementacją.

### `/loop`, `/schedule` 🟢
Skille Claude Code - powtarzające się zadania (np. "co godzinę sprawdź deploy").

### Slash commands 🟢
Skróty Claude Code zaczynające się od `/` - np. `/help`, `/clear`, `/loop`.

### Hooks 🟡
Automatyczne akcje uruchamiane na różne zdarzenia (np. "po każdym commicie zrób X"). Definiowane w `settings.json`.

### Skill 🟢
Wbudowana funkcja AI dla konkretnego zadania (np. `init`, `review`, `security-review`).

---

## 🚨 Słowa-alarmy

Te słowa powinny zwolnić twoją rękę nad klawiaturą. Pytaj AI **zanim** odpalisz:

- `rm`, `delete`, `drop`, `truncate` → usuwanie
- `--force`, `-f` → wymuszenie destrukcyjnej akcji
- `reset --hard`, `clean -f` → wymazywanie zmian
- `--no-verify`, `--no-gpg-sign` → omijanie zabezpieczeń
- `force-push` → nadpisanie historii zdalnego repo
- `migrate`, `production` w nazwie → dotyczy produkcji
- `service_role_key`, `private_key`, `secret` → sekrety, sprawdź gdzie idą
- `chmod 777` → otwarcie pliku dla wszystkich (security issue)

---

## 💡 Złote zasady

1. **Czytaj zanim klikniesz Enter.** Każda komenda którą wklejasz - zrozum przynajmniej co robi.
2. **`git status` przed `git commit`.** Sprawdź zawsze co dokładnie commitujesz.
3. **`--dry-run` najpierw.** Dla każdego nowego skryptu.
4. **Sekretne klucze NIGDY do git.** `.env` w `.gitignore` - sprawdź dwa razy.
5. **Pytaj AI o "blast radius"**: *"co się stanie jak to wykonam? Czy można cofnąć?"*
6. **Lokalnie eksperymentuj, produkcji nie.** Najpierw testuj na swoim komputerze.
7. **Commituj często, małymi krokami.** Łatwiej cofnąć jeden mały commit niż 100 zmian.

---

*Nie panikuj jak czegoś nie wiesz. Wszyscy zaczynali od zera. Każde pojęcie tutaj kiedyś wydawało się hieroglifami.* ✊
