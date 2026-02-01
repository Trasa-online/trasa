
# Plan: Uproszczenie Quick Capture - Natychmiastowe dodawanie miejsc

## Problem
Obecna logika szybkiego trybu jest zbyt skomplikowana:
1. User klika "+" → wybiera tryb → klika "Dalej" → przechodzi na stronę `/create?mode=quick`
2. Na stronie widzi Step 2 z wieloma elementami: permission prompts, EmptyState, przyciski
3. Musi kliknąć "Dodaj miejsce" → dopiero wtedy otwiera się sheet z lokalizacją

**To wymaga 4-5 kliknięć zanim user może dodać miejsce!**

## Twoja wizja
User klika "+" → wybiera "Szybki tryb" → **natychmiast** widzi prosty ekran:
- Lokalizacja auto-wykryta (zgoda już wyrażona wcześniej)
- Opcjonalne zdjęcie
- Przycisk "Zapisz"
- Gotowe w 10 sekund!

## Rozwiązanie

### Podejście: Oddzielna strona `/quick-capture`

Zamiast komplikować logikę w `CreateRoute.tsx`, stworzymy **dedykowaną, ultra-prostą stronę** dla szybkiego trybu.

```text
┌─────────────────────────────────────────┐
│  ← Wstecz              ⚡ Szybkie dodawanie  │
├─────────────────────────────────────────┤
│                                         │
│   📍 Lokalizacja                        │
│   ┌─────────────────────────────────┐   │
│   │ ✓ Kawiarnia Złota              │   │
│   │   ul. Marszałkowska 12, Warszawa│   │
│   │   [Wykryj ponownie]            │   │
│   └─────────────────────────────────┘   │
│                                         │
│   📷 Zdjęcie (opcjonalne)               │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │     [Dotknij aby dodać]         │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Lista miejsc: (2)                     │
│   ┌────┐ ┌────┐                         │
│   │ 1  │ │ 2  │                         │
│   └────┘ └────┘                         │
│                                         │
├─────────────────────────────────────────┤
│  [Zapisz miejsce]  [Zakończ trasę →]    │
└─────────────────────────────────────────┘
```

## Zmiany do wprowadzenia

### 1. Nowa strona: `src/pages/QuickCapture.tsx`
- Ultra-prosta strona dedykowana szybkiemu dodawaniu
- Auto-wykrywa lokalizację od razu przy wejściu
- Pokazuje tylko: lokalizację + zdjęcie + listę dodanych miejsc
- Przyciski: "Zapisz miejsce" (dodaje i czyści formularz) + "Zakończ trasę" (przechodzi do podsumowania)

### 2. Aktualizacja `CreateModeDrawer.tsx`
- "Szybki tryb" → nawiguje do `/quick-capture` zamiast `/create?mode=quick`
- "Szczegółowy tryb" → nawiguje do `/create` (bez zmian)

### 3. Aktualizacja routingu w `App.tsx`
- Dodanie nowej ścieżki `/quick-capture` → `QuickCapture`

### 4. Cleanup w `CreateRoute.tsx`
- Usunięcie logiki `quickCaptureMode` (już niepotrzebna)
- Usunięcie obsługi `?mode=quick` z URL
- Usunięcie `QuickAddPinSheet` (przeniesiona logika do nowej strony)
- Uproszczenie Step 2 (tylko szczegółowy tryb)

## Szczegóły techniczne

### `QuickCapture.tsx` - kluczowe elementy:

```typescript
// Stan
const [pins, setPins] = useState<QuickPin[]>([]);
const [currentLocation, setCurrentLocation] = useState(null);
const [imageUrl, setImageUrl] = useState(null);
const [detecting, setDetecting] = useState(true);

// Auto-detect location on mount
useEffect(() => {
  detectLocation();
}, []);

// Po kliknięciu "Zapisz miejsce"
const handleSavePin = () => {
  setPins([...pins, { ...currentLocation, imageUrl }]);
  setImageUrl(null); // Reset zdjęcia
  detectLocation();  // Auto-wykryj nową lokalizację
  toast({ title: "Miejsce dodane! ⚡" });
};

// Po kliknięciu "Zakończ trasę"
const handleFinish = async () => {
  // Utwórz trasę w Supabase z domyślnym tytułem
  // Dodaj wszystkie piny
  // Przekieruj do edycji/podsumowania
  navigate(`/create/${routeId}?step=3`);
};
```

### Flow użytkownika:

1. **Klik "+"** → otwiera CreateModeDrawer
2. **Wybór "Szybki tryb"** → klik "Kontynuuj"
3. **Strona QuickCapture** → lokalizacja już się wykrywa
4. **Opcjonalnie zdjęcie** → klik w obszar kamery
5. **"Zapisz miejsce"** → pin dodany, formularz się czyści, wykrywa nową lokalizację
6. **Powtórz 4-5** dla kolejnych miejsc
7. **"Zakończ trasę"** → przechodzi do podsumowania w CreateRoute

## Korzyści

- **Minimum kliknięć**: 2 kliknięcia do pierwszego pinu (wybór trybu + zapisz)
- **Auto-lokalizacja**: Nie trzeba nic klikać - lokalizacja się wykrywa
- **Ciągłość**: Po zapisaniu od razu gotowy do następnego pinu
- **Prostota**: Jeden ekran, zero kroków, zero skomplikowanej logiki
- **Czysty kod**: Oddzielna strona = łatwiejsze utrzymanie
