
# Plan: Single Source of Truth dla Pinów w CreateRoute

## Cel

Kiedy użytkownik dodaje lokalizację do trasy, system musi:
1. Sprawdzić czy ta lokalizacja już istnieje w bazie jako `canonical_pin`
2. Jeśli istnieje - pokazać informacje o odkrywcy (@username), liczbę odwiedzin i średnią ocenę
3. Jeśli nie istnieje - oznaczyć jako nowe odkrycie

## Aktualny stan

- Tabela `canonical_pins` już istnieje i przechowuje fizyczne lokalizacje
- Funkcja `find_nearby_canonical_pin` znajduje istniejący pin w promieniu 50m
- `checkPinDiscoveryInfo` zwraca tylko `originalCreatorId` i `originalCreatorUsername`
- W `CreateRoute.tsx` pokazywane jest "Odkryte przez @username", ale brakuje statystyk

## Zmiany do wprowadzenia

### 1. Rozszerzenie `src/lib/pinDiscovery.ts`

Nowa funkcja `getCanonicalPinInfo` która zwróci pełne dane:

```text
export async function getCanonicalPinInfo(latitude, longitude) {
  // 1. Wywołaj find_nearby_canonical_pin RPC
  // 2. Jeśli znajdzie - pobierz pełne dane z canonical_pins + profiles
  // 3. Zwróć:
  //    - canonicalPinId: string
  //    - discoveredByUserId: string
  //    - discoveredByUsername: string
  //    - discoveredAt: string (data)
  //    - totalVisits: number
  //    - averageRating: number
  //    - isExisting: true
  // 4. Jeśli nie znajdzie - zwróć { isExisting: false }
}
```

### 2. Aktualizacja interfejsu Pin w `CreateRoute.tsx`

Dodanie nowych pól do interfejsu `Pin`:

```text
interface Pin {
  // ... istniejące pola
  canonical_discovered_at?: string;
  canonical_total_visits?: number;
  canonical_average_rating?: number;
}
```

### 3. Aktualizacja AddressAutocomplete onChange w CreateRoute.tsx

Przy wyborze adresu:
1. Wywołać `getCanonicalPinInfo(coordinates)`
2. Zapisać wszystkie dane do pina (nie tylko creator)
3. Ustawić `isNewDiscovery[index]` na podstawie odpowiedzi

### 4. Nowa sekcja UI w CreateRoute.tsx - "Istniejące miejsce"

Po wybraniu adresu, jeśli miejsce istnieje w bazie, pokazać kartę:

```text
┌─────────────────────────────────────────────────────┐
│ 📍 Odkryte przez @username                          │
│ 12 stycznia 2025                                    │
├─────────────────────────────────────────────────────┤
│ 👥 5 wizyt    ⭐ 4.2 średnia ocena                  │
└─────────────────────────────────────────────────────┘
```

Styl: `bg-muted/50` z ikonami (Users, Star, Trophy) spójny z PinDetails.

### 5. Aktualizacja MapPinSelector callback

Analogiczna zmiana dla wyboru lokalizacji z mapy - pobierz pełne dane canonical pin.

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `src/lib/pinDiscovery.ts` | Nowa funkcja `getCanonicalPinInfo()` z pełnymi statystykami |
| `src/pages/CreateRoute.tsx` | Rozszerzenie interfejsu Pin, aktualizacja callbacków, nowa sekcja UI |

## Szczegóły techniczne

### Nowa funkcja w pinDiscovery.ts

```typescript
export interface CanonicalPinInfo {
  isExisting: boolean;
  canonicalPinId?: string;
  discoveredByUserId?: string;
  discoveredByUsername?: string;
  discoveredByAvatar?: string;
  discoveredAt?: string;
  totalVisits?: number;
  averageRating?: number;
}

export async function getCanonicalPinInfo(
  latitude: number | undefined,
  longitude: number | undefined
): Promise<CanonicalPinInfo> {
  if (!latitude || !longitude) {
    return { isExisting: false };
  }

  // Wywołaj RPC do znalezienia pobliskiego pina
  const { data: nearbyPinId } = await supabase.rpc('find_nearby_canonical_pin', {
    search_lat: latitude,
    search_lng: longitude,
    radius_meters: 50
  });

  if (!nearbyPinId) {
    return { isExisting: false };
  }

  // Pobierz pełne dane canonical pin z profilem odkrywcy
  const { data: canonicalPin } = await supabase
    .from('canonical_pins')
    .select(`
      id,
      total_visits,
      average_rating,
      discovered_at,
      discovered_by_user_id,
      discovered_by:discovered_by_user_id (
        id,
        username,
        avatar_url
      )
    `)
    .eq('id', nearbyPinId)
    .single();

  return {
    isExisting: true,
    canonicalPinId: canonicalPin.id,
    discoveredByUserId: canonicalPin.discovered_by_user_id,
    discoveredByUsername: canonicalPin.discovered_by?.username,
    discoveredByAvatar: canonicalPin.discovered_by?.avatar_url,
    discoveredAt: canonicalPin.discovered_at,
    totalVisits: canonicalPin.total_visits,
    averageRating: canonicalPin.average_rating,
  };
}
```

### Nowy komponent UI w CreateRoute.tsx

Po sekcji adresu (linia ~1580), zamiast obecnego prostego badge "Odkryte przez", wyświetl:

```tsx
{/* Existing Place Info Card */}
{pins[currentPinIndex]?.canonical_pin_id && 
 !isNewDiscovery[currentPinIndex] && (
  <div className="mt-3 bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
    {/* Discoverer info */}
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={pins[currentPinIndex]?.canonical_discoverer_avatar} />
        <AvatarFallback>
          {pins[currentPinIndex]?.original_creator_username?.[0]}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-1.5 text-sm">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span>Odkryte przez </span>
          <Link 
            to={`/profile/${pins[currentPinIndex]?.original_creator_id}`}
            className="font-semibold hover:text-primary"
          >
            @{pins[currentPinIndex]?.original_creator_username}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(pins[currentPinIndex]?.canonical_discovered_at)}
        </p>
      </div>
    </div>
    
    {/* Stats row */}
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>{pins[currentPinIndex]?.canonical_total_visits || 0} wizyt</span>
      </div>
      {(pins[currentPinIndex]?.canonical_average_rating || 0) > 0 && (
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 fill-star text-star" />
          <span>{pins[currentPinIndex]?.canonical_average_rating?.toFixed(1)}</span>
        </div>
      )}
    </div>
  </div>
)}
```

## Korzyści

- **Single source of truth** - każda fizyczna lokalizacja ma jedno kanoniczne źródło danych
- **Pełne informacje przy tworzeniu** - użytkownik od razu widzi, że miejsce już istnieje z pełnymi statystykami
- **Spójność z PinDetails** - te same dane wyświetlane przy tworzeniu i przeglądaniu
- **Gamifikacja** - zachęta do odkrywania nowych miejsc (badge "Pierwszy odkrywca")
