

## Optymalizacja kosztów Google Places Photos

### Obecne koszty (per otwarcie szczegółów miejsca)

| Wywołanie | Koszt |
|-----------|-------|
| Find Place | $0.017 |
| Place Details | $0.017 |
| Photos (do 6 szt.) | 6 × $0.007 = **$0.042** |
| **Razem** | **~$0.076** |

Zdjęcia stanowią **55% kosztu** każdego otwarcia.

Dodatkowo zdjęcia pobierane są w: PlaceSwiper (do 5), PlanChatExperience (1-2), UpcomingTripCard (1).

### Po optymalizacji (1 zdjęcie + cache w Supabase Storage)

| Wywołanie | Koszt |
|-----------|-------|
| Find Place | $0.017 |
| Place Details | $0.017 |
| Photo (1 szt., pierwsze pobranie) | $0.007 |
| Photo (kolejne wyświetlenia) | **$0.00** |
| **Razem — pierwsze** | **~$0.041** |
| **Razem — kolejne** | **~$0.034** |

**Oszczędność: 46-55% na każde wyświetlenie.** Przy 100 unikalnych miejscach jednorazowy koszt zdjęć spada z ~$4.20 (6 zdjęć × 100) do ~$0.70 (1 zdjęcie × 100), a każde kolejne wyświetlenie = $0.

### Plan implementacji

**1. Migracja SQL**
- Tabela `place_photo_cache` (photo_reference → public_url w Storage)
- Bucket `place-photos` (publiczny, read-only dla anonów)

**2. Edge Function `google-places-proxy` — nowa akcja `cache-photo`**
- Sprawdza cache → jeśli jest, zwraca URL z Storage
- Jeśli brak: pobiera 1 zdjęcie z Google, uploaduje do `place-photos`, zapisuje w tabeli, zwraca URL

**3. Helper `src/lib/placePhotos.ts`**
- Funkcja `getCachedPhotoUrl(photoRef, maxWidth)` — woła edge function, zwraca URL z cache

**4. Aktualizacja 5 komponentów — wszędzie 1 zdjęcie zamiast wielu**
- `PlaceDetailSheet.tsx` — 1 zdjęcie główne (zamiast 6)
- `PlaceSwiper.tsx` — 1 zdjęcie (zamiast 5)
- `PlaceSwiperDetail.tsx` — 1 zdjęcie (zamiast 5)
- `PlanChatExperience.tsx` — bez zmian (już 1)
- `UpcomingTripCard.tsx` — bez zmian (już 1)

### Strategia biznesowa
Ograniczenie do 1 zdjęcia dla zwykłych miejsc tworzy naturalną wartość dodaną dla **wizytówki premium** — biznesy mogą wykupić pełną galerię zdjęć (uploadowaną przez nich, zero kosztów Google API).

### Pliki do utworzenia/edycji
1. Nowa migracja SQL (tabela + bucket + RLS)
2. `supabase/functions/google-places-proxy/index.ts` — akcja `cache-photo`
3. `src/lib/placePhotos.ts` (nowy)
4. `src/components/home/PlaceDetailSheet.tsx`
5. `src/components/plan-wizard/PlaceSwiper.tsx`
6. `src/components/plan-wizard/PlaceSwiperDetail.tsx`

