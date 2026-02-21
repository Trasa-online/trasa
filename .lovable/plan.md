

# Naprawa widoku szczegółów miejsca (PlaceDetailDrawer)

## Problem
Kliknięcie w punkt na trasie otwiera drawer ze szczegółami, ale dane nie ładują się z powodu błędu CORS. Komponent `PlaceDetailDrawer.tsx` wywołuje Google Places API bezpośrednio z przeglądarki, co jest zablokowane -- Google nie pozwala na takie zapytania z kodu frontendowego.

## Rozwiązanie
Stworzyć edge function w Supabase, która będzie pośrednikiem (proxy) między frontendem a Google Places API. Frontend wyśle zapytanie do naszej edge function, a ta pobierze dane z Google i zwróci je do przeglądarki.

## Kroki

1. **Nowa edge function `google-places-proxy`**
   - Przyjmuje parametry: `placeName`, `latitude`, `longitude`
   - Wykonuje zapytania do Google Places API (Find Place + Place Details)
   - Zwraca dane o miejscu do frontendu

2. **Aktualizacja `PlaceDetailDrawer.tsx`**
   - Zamiana bezpośrednich wywołań `fetch` do `maps.googleapis.com` na wywołanie edge function przez klienta Supabase (`supabase.functions.invoke`)
   - Reszta logiki wyświetlania pozostaje bez zmian

## Szczegóły techniczne

**Edge function** (`supabase/functions/google-places-proxy/index.ts`):
- Odczytuje `GOOGLE_MAPS_API_KEY` ze zmiennych środowiskowych
- Endpoint POST przyjmuje JSON z `placeName`, `latitude`, `longitude`
- Wykonuje 2 zapytania do Google: findplacefromtext + place details
- Zwraca obiekt z danymi miejsca lub błąd

**Frontend** (`PlaceDetailDrawer.tsx`):
- Zamiast 2-3 bezpośrednich fetch do Google, jeden invoke do edge function
- Obsługa błędów pozostaje taka sama
