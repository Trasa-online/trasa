

# Naprawa widoku szczegółów miejsca (PlaceDetailDrawer)

## Problem
Komponent `PlaceDetailDrawer.tsx` wywołuje Google Places API bezpośrednio z przeglądarki (`fetch` do `maps.googleapis.com`). Google blokuje takie zapytania z poziomu frontendu (CORS). Edge function `google-places-proxy`, ktora miala to rozwiazac, nigdy nie zostala utworzona.

## Rozwiazanie
Stworzyc edge function jako proxy i zaktualizowac frontend.

## Kroki

### 1. Dodanie secretu `GOOGLE_MAPS_API_KEY` do Supabase
- Klucz: `AIzaSyCdZ-on1_mKr1Q9OTDYkqkk4OzB7SwR32M` (ten sam co w `src/lib/googleMaps.ts`)
- Bedzie dostepny w edge function przez `Deno.env.get("GOOGLE_MAPS_API_KEY")`

### 2. Nowa edge function `google-places-proxy`
Plik: `supabase/functions/google-places-proxy/index.ts`
- Endpoint POST przyjmujacy JSON: `{ placeName, latitude, longitude }`
- Obsluga CORS (preflight OPTIONS + naglowki)
- Krok 1: Find Place from Text (szukanie `place_id` po nazwie + lokalizacji)
- Krok 2 (fallback): Nearby Search jesli krok 1 nie zwroci wynikow
- Krok 3: Place Details (pobranie pelnych danych: rating, zdjecia, opinie, adres, geometria)
- Zwraca dane miejsca jako JSON lub blad

### 3. Konfiguracja w `supabase/config.toml`
- Dodanie sekcji `[functions.google-places-proxy]` z `verify_jwt = false`

### 4. Aktualizacja `PlaceDetailDrawer.tsx`
- Usuniecie bezposrednich wywolan `fetch` do Google
- Zastapienie jednym wywolaniem `supabase.functions.invoke("google-places-proxy", { body: { placeName, latitude, longitude } })`
- Reszta logiki wyswietlania (zdjecia, opinie, mapa) pozostaje bez zmian
- Zdjecia i mapa statyczna nadal beda ladowane bezposrednio z Google (to sa publiczne URL-e obrazkow, nie API calls, wiec CORS ich nie blokuje)

## Szczegoly techniczne

**Edge function** wykona te same zapytania co dotychczasowy frontend:
1. `findplacefromtext` -- szukanie place_id
2. `nearbysearch` -- fallback
3. `place/details` -- pobranie szczegolowych danych

**Frontend** zamieni ~15 linii kodu fetch na:
```typescript
const { data, error } = await supabase.functions.invoke("google-places-proxy", {
  body: { placeName, latitude, longitude }
});
```
