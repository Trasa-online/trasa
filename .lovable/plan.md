

# Plan: Szybki tryb w jednym Drawerze - bez nawigacji

## Problem
Obecny flow jest zbyt skomplikowany:
1. Klik "+" otwiera drawer
2. Wybór trybu + klik "Kontynuuj"
3. Nawigacja do osobnej strony `/quick-capture`
4. Czekanie na załadowanie strony
5. Dopiero wtedy lokalizacja się wykrywa

**To 3-4 kliknięcia i zmiana strony zanim user może cokolwiek zrobić!**

## Rozwiazanie: Wszystko w Drawerze

Zamiast nawigować do osobnej strony, po wybraniu "Szybki tryb" drawer zmienia się w tryb dodawania miejsc:

```text
┌─────────────────────────────────────────┐
│   ━━━━━━━━━━                           │ (drawer handle)
├─────────────────────────────────────────┤
│  ⚡ Szybkie dodawanie                   │
├─────────────────────────────────────────┤
│                                         │
│  TRASA: [Dropdown ▼]                    │
│  ┌─────────────────────────────────────┐│
│  │ + Nowa trasa                        ││
│  │ • Wypad poza miasto Celestynów      ││
│  │ • Katowice Konferencja              ││
│  └─────────────────────────────────────┘│
│                                         │
│  📍 LOKALIZACJA:                        │
│  ┌─────────────────────────────────────┐│
│  │ ✓ Kawiarnia Złota                   ││
│  │   ul. Marszałkowska 12, Warszawa    ││
│  │   [🔄 Wykryj ponownie]              ││
│  └─────────────────────────────────────┘│
│  LUB: [Wpisz adres ręcznie...]         │
│                                         │
│  📷 ZDJĘCIE: (opcjonalne)              │
│  [    Dotknij aby dodać    ]           │
│                                         │
│  ────────────────────────────────────  │
│  Dodane: 📍2  📍1  📍 (miniaturki)      │
│                                         │
│  [  ✓ Zapisz miejsce  ]  [Zakończ →]   │
└─────────────────────────────────────────┘
```

## Flow uzytkownika (NOWY)

1. **Klik "+"** - otwiera drawer z wyborem trybu
2. **Klik "Szybki tryb"** - drawer natychmiast przechodzi do trybu szybkiego dodawania (bez "Kontynuuj"!)
3. **Lokalizacja wykrywa się automatycznie** - user widzi swoją pozycję w ciągu sekundy
4. **Opcjonalnie zdjęcie** - klik w obszar zdjęcia
5. **"Zapisz miejsce"** - dodaje pin, czyści formularz, wykrywa nową lokalizację
6. **"Zakończ"** - tworzy trasę i przechodzi do edycji/podsumowania

**Rezultat: 2 kliknięcia do pierwszego pinu!** (+ wybór trybu + zapisz)

## Zmiany do wprowadzenia

### 1. Rozbudowa `CreateModeDrawer.tsx`

Drawer będzie miał dwa stany:
- `mode: 'select'` - wybór trybu (obecny widok)
- `mode: 'quick-capture'` - tryb szybkiego dodawania (nowy widok)

Kliknięcie "Szybki tryb" natychmiast przechodzi do `quick-capture` (bez przycisku "Kontynuuj").

### 2. Logika szybkiego dodawania w Drawerze

Drawer będzie zawierał:
- **Wybór trasy**: Dropdown z opcjami:
  - "Nowa trasa" (domyślnie, z auto-generowanym tytułem)
  - Lista wersji roboczych usera (max 5 ostatnich)
- **Auto-lokalizacja**: Wykrywanie GPS od razu po przejściu do trybu quick-capture
- **Fallback na ręczne wpisanie**: Komponent AddressAutocomplete jako alternatywa
- **Zdjęcie**: Opcjonalne, z kamerą
- **Lista dodanych miejsc**: Miniaturki z numerami
- **Przyciski**: "Zapisz miejsce" + "Zakończ trasę"

### 3. Usunięcie `/quick-capture` page

Strona `QuickCapture.tsx` nie będzie już potrzebna - cała logika przeniesiona do drawera.

### 4. Aktualizacja routingu

- Usunięcie ścieżki `/quick-capture` z `App.tsx`
- Usunięcie pliku `src/pages/QuickCapture.tsx`

## Szczegoly techniczne

### Stan drawera:

```typescript
type DrawerMode = 'select' | 'quick-capture';

const [mode, setMode] = useState<DrawerMode>('select');
const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
const [pins, setPins] = useState<QuickPin[]>([]);
const [location, setLocation] = useState<Location | null>(null);
const [detectingLocation, setDetectingLocation] = useState(false);
const [imageUrl, setImageUrl] = useState<string | null>(null);
const [drafts, setDrafts] = useState<DraftRoute[]>([]);
```

### Wybor trybu (natychmiastowy):

```typescript
// Klikniecie "Szybki tryb" od razu przechodzi do quick-capture
<button onClick={() => {
  setMode('quick-capture');
  detectLocation(); // Zaczyna wykrywanie od razu
  fetchUserDrafts(); // Pobiera wersje robocze
}}>
  Szybki tryb
</button>
```

### Wybor trasy (dropdown):

```typescript
<Select value={selectedRouteId || 'new'} onValueChange={handleRouteSelect}>
  <SelectTrigger>
    <SelectValue placeholder="Wybierz lub utworz trase" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="new">
      + Nowa trasa ({defaultTitle})
    </SelectItem>
    {drafts.map(draft => (
      <SelectItem key={draft.id} value={draft.id}>
        {draft.title}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Zapisywanie pinu:

```typescript
const handleSavePin = async () => {
  if (!location) return;
  
  // Jezeli nowa trasa - utworz ja najpierw
  let routeId = selectedRouteId;
  if (!routeId) {
    const { data } = await supabase.from('routes').insert({
      user_id: user.id,
      title: defaultTitle,
      status: 'draft'
    }).select().single();
    routeId = data.id;
    setSelectedRouteId(routeId);
  }
  
  // Dodaj pin do bazy
  await supabase.from('pins').insert({
    route_id: routeId,
    place_name: location.place_name,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    image_url: imageUrl,
    pin_order: pins.length
  });
  
  // Reset i wykryj nowa lokalizacje
  setPins([...pins, { ...location, image_url: imageUrl }]);
  setImageUrl(null);
  detectLocation();
  
  toast({ title: "Miejsce dodane! ⚡" });
};
```

## Korzysci

- **Minimum klikniec**: 2 kliknięcia do pierwszego pinu
- **Brak nawigacji**: Wszystko dzieje się w drawerze, bez zmiany strony
- **Natychmiastowe dzialanie**: Lokalizacja wykrywa się od razu po wyborze trybu
- **Wybor trasy**: Można dodawać do istniejącej wersji roboczej
- **Ciaglosc**: Drawer pozostaje otwarty - można dodawać kolejne miejsca

