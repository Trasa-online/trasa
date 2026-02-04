
# Plan wdrożenia: Notatki na trasie z typami

## Cel
Rozbudowanie obecnego systemu "Ciekawostek" o wsparcie dla wielu typów notatek, które lepiej opisuja rozne aspekty podrozy - od ciekawostek, przez doswiadczenia, po praktyczne rady i ostrzezenia.

---

## Faza 1: Zmiany w bazie danych

### 1.1 Migracja - dodanie kolumny `note_type`

Dodanie nowej kolumny do tabeli `route_notes`:

```sql
ALTER TABLE public.route_notes 
ADD COLUMN note_type text NOT NULL DEFAULT 'fact';

COMMENT ON COLUMN public.route_notes.note_type IS 
'Typ notatki: fact (ciekawostka), experience (doswiadczenie), tip (rada), warning (ostrzezenie)';
```

**Typy notatek:**
| Typ | Klucz | Ikona | Kolor |
|-----|-------|-------|-------|
| Ciekawostka | `fact` | Sparkles | Amber (obecny) |
| Doswiadczenie | `experience` | Heart | Rose |
| Rada | `tip` | Lightbulb | Blue |
| Ostrzezenie | `warning` | AlertTriangle | Orange |

---

## Faza 2: Aktualizacja interfejsu typow

### 2.1 Nowy typ TypeScript

Utworzenie stalych i typow w nowym pliku `src/lib/noteTypes.ts`:

```typescript
export const NOTE_TYPES = {
  fact: {
    label: 'Ciekawostka',
    icon: Sparkles,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
    labelColor: 'text-amber-600 dark:text-amber-400',
  },
  experience: {
    label: 'Doswiadczenie',
    icon: Heart,
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-500',
    labelColor: 'text-rose-600 dark:text-rose-400',
  },
  tip: {
    label: 'Rada',
    icon: Lightbulb,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
    labelColor: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    label: 'Ostrzezenie',
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-500',
    labelColor: 'text-orange-600 dark:text-orange-400',
  },
} as const;

export type NoteType = keyof typeof NOTE_TYPES;
```

---

## Faza 3: Modyfikacja komponentu tworzenia

### 3.1 Aktualizacja `PinNotesSection.tsx`

**Zmiany w interfejsie `PinNote`:**
```typescript
interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
  note_type: NoteType; // NOWE
}
```

**Nowy UI wyboru typu** - przed polem tekstowym pojawia sie selektor typu:

```text
+------------------------------------------+
| [Ciekawostka] [Doswiadczenie] [Rada] [!] |   <- przyciski typu
+------------------------------------------+
| [                Tekst notatki...      ] |
|                                    [Foto]|
+------------------------------------------+
```

Przyciski typu beda:
- Kompaktowe ikony z tooltipem
- Aktywny typ podswietlony kolorem
- Domyslnie wybrana "Ciekawostka" (fact)

### 3.2 Zmiana etykiety sekcji

Z "Ciekawe na trasie" na "Notatki na trasie" z nowa ikona (StickyNote lub NotebookPen).

---

## Faza 4: Modyfikacja wyswietlania

### 4.1 Aktualizacja `RouteDetails.tsx` - komponent `RouteNotesDisplay`

Kazda notatka bedzie wyswietlana z odpowiednim stylem na podstawie `note_type`:

```text
+-- Ciekawostka ----------------------+
| [Sparkles] Ciekawe na trasie        |
|                                     |
| Tekst notatki o ciekawostce...      |
+-------------------------------------+

+-- Doswiadczenie --------------------+
| [Heart] Doswiadczenie               |
|                                     |
| To miejsce ma magiczna atmosfere... |
+-------------------------------------+
```

### 4.2 Logika wyswietlania

- Notatki grupowane przy odpowiednich pinach (bez zmian)
- Kazdy typ ma wlasny kolor tla, obramowania i ikone
- Etykieta dynamiczna na podstawie `note_type`

---

## Faza 5: Aktualizacja zapisywania

### 5.1 `CreateRoute.tsx` - funkcja `autoSaveRoute`

Dodanie `note_type` do obiektow notatek przy zapisie:

```typescript
allNotesToInsert.push({
  route_id: routeIdRef.current,
  pin_id: insertedPin.id,
  text: note.text,
  image_url: note.imageUrl,
  note_order: note.note_order,
  note_type: note.note_type || 'fact', // NOWE
});
```

### 5.2 Wczytywanie istniejacych tras

Przy edycji trasy - mapowanie `note_type` z bazy na stan komponentu.

---

## Podsumowanie zmian w plikach

| Plik | Rodzaj zmiany |
|------|---------------|
| `supabase/migrations/[nowa].sql` | Dodanie kolumny `note_type` |
| `src/lib/noteTypes.ts` | NOWY - definicje typow i stylowania |
| `src/components/route/PinNotesSection.tsx` | Dodanie selektora typu, aktualizacja interfejsu |
| `src/pages/CreateRoute.tsx` | Zapis `note_type`, wczytywanie przy edycji |
| `src/pages/RouteDetails.tsx` | Dynamiczne stylowanie na podstawie typu |

---

## Szczegoly techniczne

### Wybor typu w UI

Selektor typow bedzie zaimplementowany jako grupa przyciskow Toggle:

```tsx
<ToggleGroup type="single" value={noteType} onValueChange={setNoteType}>
  {Object.entries(NOTE_TYPES).map(([key, config]) => (
    <ToggleGroupItem key={key} value={key} className="...">
      <config.icon className="h-4 w-4" />
    </ToggleGroupItem>
  ))}
</ToggleGroup>
```

### Kompatybilnosc wsteczna

- Istniejace notatki bez `note_type` beda traktowane jako `fact` (domyslna wartosc)
- Migracja nie wymaga aktualizacji istniejacych danych

### Przyszle rozszerzenia (poza zakresem)

- Oficjalne notatki biznesowe dla Premium Pins
- Filtrowanie notatek po typie w widoku trasy
- Statystyki typow notatek w profilu uzytkownika
