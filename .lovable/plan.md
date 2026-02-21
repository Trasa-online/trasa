

# Naprawa PlaceDetailDrawer - Google Places proxy

## Problem
Komponent `PlaceDetailDrawer.tsx` wywoluje Google Places API bezposrednio z przegladarki, co jest blokowane przez CORS. Edge function proxy nigdy nie zostala utworzona, a secret `GOOGLE_MAPS_API_KEY` nie istnieje w Supabase.

## Kroki implementacji

### 1. Dodanie secretu GOOGLE_MAPS_API_KEY
- Wartość: `AIzaSyCdZ-on1_mKr1Q9OTDYkqkk4OzB7SwR32M` (ten sam klucz co w `src/lib/googleMaps.ts`)
- Będzie dostępny w edge function przez `Deno.env.get("GOOGLE_MAPS_API_KEY")`

### 2. Nowa edge function `google-places-proxy`
Plik: `supabase/functions/google-places-proxy/index.ts`
- POST endpoint przyjmujący `{ placeName, latitude, longitude }`
- Obsługa CORS (OPTIONS preflight + nagłówki)
- Krok 1: Find Place from Text (szukanie place_id)
- Krok 2 (fallback): Nearby Search jeśli brak wyników
- Krok 3: Place Details (rating, zdjęcia, opinie, adres, geometria)
- Zwraca dane jako JSON

### 3. Konfiguracja w `supabase/config.toml`
- Dodanie `[functions.google-places-proxy]` z `verify_jwt = false`

### 4. Aktualizacja `PlaceDetailDrawer.tsx`
- Usunięcie bezpośrednich fetch do Google
- Zastąpienie wywołaniem `supabase.functions.invoke("google-places-proxy", { body: { placeName, latitude, longitude } })`
- Zdjęcia i mapa statyczna nadal ładowane bezpośrednio (publiczne URL-e obrazków, CORS nie blokuje)

## Szczegóły techniczne

Edge function wykonuje te same zapytania co dotychczasowy frontend, ale po stronie serwera:
1. `findplacefromtext` -- szukanie place_id po nazwie + lokalizacji
2. `nearbysearch` -- fallback jeśli brak wyników
3. `place/details` -- pobranie szczegółów (fields: name, rating, user_ratings_total, price_level, types, formatted_address, photos, reviews, geometry)

Frontend zmieni ~15 linii kodu fetch na jedno wywołanie:
```
const { data, error } = await supabase.functions.invoke("google-places-proxy", {
  body: { placeName, latitude, longitude }
});
```

