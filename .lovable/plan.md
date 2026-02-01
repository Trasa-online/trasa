
# Plan: Sekcja "Odwiedzający" - przycisk "Twoje wrażenia" + limit opinii

## Cel

Zmodyfikować sekcję "Odwiedzający" w widoku pojedynczej pinezki (`/pin/:pinId`):
1. Pokazywać tylko 3 opinie domyślnie
2. Dodać tekst "Pokaż więcej" do rozwinięcia wszystkich opinii
3. Dodać przycisk secondary "Twoje wrażenia" na dole sekcji
4. Po kliknięciu "Twoje wrażenia" - pokazać drawer zamiast obecnego dialogu

## Aktualny stan

- `PinVisitDialog` już istnieje i obsługuje dodawanie/edycję oceny, opisu i zdjęcia
- Jest renderowany jako `Dialog` (modal)
- `showVisitDialog` state już istnieje w `PinDetails.tsx`
- Sekcja "Odwiedzający" pokazuje wszystkie wizyty bez limitu

## Zmiany do wprowadzenia

### 1. Nowy state dla "Pokaż więcej"

```typescript
const [showAllVisits, setShowAllVisits] = useState(false);
```

### 2. Ograniczenie wyświetlanych wizyt do 3

W sekcji "Odwiedzający" zamiast mapowania wszystkich:
```tsx
// Przed
{allCanonicalVisits.map((visit: any) => {...})}

// Po
{(showAllVisits ? allCanonicalVisits : allCanonicalVisits.slice(0, 3)).map((visit: any) => {...})}
```

### 3. Tekst "Pokaż więcej" (nie button)

Po mapie wizyt, jeśli jest więcej niż 3:
```tsx
{allCanonicalVisits.length > 3 && !showAllVisits && (
  <p 
    onClick={() => setShowAllVisits(true)}
    className="text-sm text-muted-foreground hover:text-primary cursor-pointer text-center py-2"
  >
    Pokaż więcej ({allCanonicalVisits.length - 3})
  </p>
)}
```

### 4. Nowy komponent PinVisitDrawer

Utworzyć nowy komponent `src/components/route/PinVisitDrawer.tsx` który używa `Drawer` zamiast `Dialog`:

- Przeniesie całą logikę z `PinVisitDialog`
- Zmieni `Dialog` na `Drawer` z `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`
- Zachowa tę samą funkcjonalność (ocena gwiazdkami, opis, upload zdjęcia)

### 5. Przycisk "Twoje wrażenia" na dole sekcji

Po liście wizyt i "Pokaż więcej":
```tsx
<div className="mt-4">
  <Button 
    variant="secondary" 
    className="w-full"
    onClick={() => setShowVisitDialog(true)}
  >
    Twoje wrażenia
  </Button>
</div>
```

### 6. Zamiana PinVisitDialog na PinVisitDrawer

W renderze:
```tsx
{user && (
  <PinVisitDrawer
    open={showVisitDialog}
    onOpenChange={setShowVisitDialog}
    pinId={pinId || ""}
    pinName={displayName || pin.address}
    userId={user.id}
    existingVisit={hasVisited ? {...} : null}
  />
)}
```

## Pliki do modyfikacji/utworzenia

| Plik | Operacja | Opis |
|------|----------|------|
| `src/components/route/PinVisitDrawer.tsx` | Utworzenie | Nowy komponent drawer z formularzem oceny |
| `src/pages/PinDetails.tsx` | Modyfikacja | State, limit 3 opinii, "Pokaż więcej", przycisk "Twoje wrażenia", import drawera |

## Szczegóły komponentu PinVisitDrawer

```tsx
// Imports
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
// ... pozostałe importy jak w PinVisitDialog

// Interfejs identyczny jak PinVisitDialog
interface PinVisitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinId: string;
  pinName: string;
  userId: string;
  existingVisit?: {
    image_url?: string;
    description?: string;
    rating?: number;
  } | null;
}

// Logika taka sama jak w PinVisitDialog
// Zmiana struktury JSX:

return (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="max-h-[90vh]">
      <DrawerHeader>
        <DrawerTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {isEditing ? "Edytuj swoją opinię" : "Twoje wrażenia"}
        </DrawerTitle>
        <DrawerDescription>{pinName}</DrawerDescription>
      </DrawerHeader>
      
      <div className="px-4 pb-4 space-y-5 overflow-y-auto">
        {/* Rating - identyczne */}
        {/* Description - identyczne */}
        {/* Image upload - identyczne */}
      </div>
      
      <DrawerFooter>
        {/* Buttons - identyczne */}
      </DrawerFooter>
    </DrawerContent>
    
    {/* Delete Confirmation AlertDialog - identyczne */}
  </Drawer>
);
```

## Wizualizacja zmian UI

```text
┌────────────────────────────────────────────────────┐
│ 👥 Odwiedzający (5)                                │
├────────────────────────────────────────────────────┤
│ [Wizyta 1 - Avatar, username, ocena, opis...]     │
│ [Wizyta 2 - Avatar, username, ocena, opis...]     │
│ [Wizyta 3 - Avatar, username, ocena, opis...]     │
│                                                    │
│            Pokaż więcej (2)                        │  ← tekst klikalny
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │              Twoje wrażenia                    │ │  ← Button secondary
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

Po kliknięciu "Twoje wrażenia" - drawer wysuwa się z dołu z formularzem.
