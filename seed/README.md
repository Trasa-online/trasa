# Trasa — bulk seed script

Importuje miejsca (places + business_profiles) do Supabase z pliku CSV i folderów ze zdjęciami.

## Co skrypt robi

Dla każdego wiersza w `data/places.csv`:

1. Bierze zdjęcia z `data/photos/{slug}/` i resize'uje je do max 1500px / JPEG q80
2. Uploaduje do Supabase Storage (bucket `places-photos`)
3. Wstawia rekord do tabeli `places` (catalog — widoczny userom)
4. **Jeśli są extras** (gallery / wideo / logo / phone / website / hours): wstawia też ownerless rekord do `business_profiles` (gotowy do claim'u przez właściciela lokalu)
5. Zapisuje slug do `_processed.txt` — kolejne uruchomienie pominie już-zaimportowane

## Setup (jednorazowo)

### 1. Zainstaluj dependencies

```bash
cd seed
npm install
```

### 2. Stwórz bucket w Supabase

Supabase Dashboard → **Storage → New bucket**:
- Name: `places-photos`
- **Public**: ON (czytanie zdjęć bez auth)

### 3. Skonfiguruj `.env`

```bash
cp .env.example .env
```

Edytuj `.env`:
- `SUPABASE_URL` — z Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — sekretny key z Project Settings → API → "service_role"

⚠️ **Service role key omija RLS — TYLKO lokalnie. Nigdy nie commituj!**

## Użycie

### 1. Skopiuj template CSV

```bash
cp data/places.csv.example data/places.csv
```

Edytuj `data/places.csv` — dodawaj wiersze z lokalami.

### 2. Wrzuć zdjęcia do `data/photos/{slug}/`

Dla `slug=wesola-cafe-krakow`:

```
data/photos/wesola-cafe-krakow/
├── cover.jpg          ← główne zdjęcie (lub cover.mp4 dla wideo)
├── logo.jpg           ← logo lokalu (opcjonalne)
├── gallery-1.jpg      ← galeria
├── gallery-2.jpg
└── gallery-3.jpg
```

**Konwencje nazewnictwa:**
- `cover.jpg` / `cover.png` / `cover.webp` — kluczowe zdjęcie (1)
- `cover.mp4` / `cover.mov` — wideo okładkowe (1, max 7 sek przed uploadem)
- `logo.jpg` — opcjonalne logo lokalu (1)
- `gallery-1.jpg`, `gallery-2.jpg`, ... — galeria (max ile chcesz)

### 3. Test (dry run — nic nie zapisuje)

```bash
npm run seed:dry
```

Pokaże co byłoby wgrane. Sprawdź outputy.

### 4. Real run

```bash
npm run seed
```

## Kolumny CSV

| Kolumna | Wymagane? | Opis | Przykład |
|---|---|---|---|
| `slug` | ✅ | Unique key + nazwa folderu zdjęć (kebab-case) | `wesola-cafe-krakow` |
| `place_name` | ✅ | Wyświetlana nazwa | `Wesoła Café` |
| `city` | ✅ | Miasto | `Kraków` |
| `category` | ✅ | Kategoria główna | `food`, `culture`, `nature`, `nightlife` |
| `address` | | Pełny adres | `ul. Wesoła 12, Kraków` |
| `latitude` | | Szerokość geograficzna | `50.0619` |
| `longitude` | | Długość geograficzna | `19.9442` |
| `description` | | Opis (max 500 znaków) | `Specialty coffee w sercu...` |
| `vibe_tags` | | CSV w komórce | `specialty_coffee,must-see` |
| `best_time` | | CSV: morning/afternoon/evening/night | `morning,afternoon` |
| `price_level` | | 1-4 | `2` |
| `rating` | | Float 1-5 | `4.7` |
| `google_place_id` | | Z Google Places | `ChIJ_xxxx` |
| `subcategories` | | CSV — tylko dla business_profile | `kawiarnia,bistro` |
| `phone` | | Telefon | `+48 123 456 789` |
| `website` | | Strona WWW | `https://wesolacafe.pl` |
| `instagram` | | Handle IG | `@wesola.cafe` |
| `email` | | Email kontaktowy | `kontakt@wesolacafe.pl` |
| `opening_hours_json` | | JSON string z godzinami | (zobacz example) |

## Resume — jak skrypt się wywali w połowie

Plik `_processed.txt` przechowuje slug'i już zaimportowanych. Przy ponownym uruchomieniu pominie je.

Jeśli chcesz **re-import** jakiegoś slug'a — usuń go z `_processed.txt` i wywołaj ponownie. Uwaga: zostanie wstawiony **drugi rekord w places** (nie ma upsertu po slug'u — slug jest tylko nazwą folderu, nie kolumną w bazie).

## Czyszczenie testowych wpisów

Jeśli zrobisz test i chcesz wyczyścić:

```sql
-- Wszystkie ownerless business_profiles
delete from business_profiles where owner_user_id is null;

-- Konkretne places (po nazwie)
delete from places where place_name in ('Wesoła Café', 'Piwnica pod Baranami');

-- Storage — usuń folder w Dashboard → Storage → places-photos → wybierz → delete
```

## Troubleshooting

**"Storage upload failed: new row violates row-level security policy"**
→ Bucket nie jest public lub brak policy na INSERT. Sprawdź w Storage → bucket → Policies.

**"places insert failed: ... violates not-null constraint"**
→ Brakuje wymaganej kolumny w CSV (place_name, city, category).

**"sharp installation error"**
→ Sharp wymaga binariów platformowych. Spróbuj `npm install --force` lub `npm install sharp --platform=darwin --arch=arm64` (M1/M2 Mac).

## Workflow Bartka — jak to się ma do outreach'u

1. Bart zbiera dane lokalu (Sheets) + zdjęcia (folder)
2. Ty raz w tygodniu odpalasz `npm run seed`
3. Ten sam wieczór Bart wysyła link do form'a "Czy to Twój lokal?" (`trasa.travel/lokal/{place_id}`)
4. Lokal claim'uje → przejmuje business_profile → ma dashboard z analityką
