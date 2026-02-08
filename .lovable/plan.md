

# Foldery z trasami - Koncepcja implementacji

## Idea

User tworzy folder (np. "JAPONIA"), a w nim grupuje poszczegolne trasy jako "dni" (#1, #2, #3...). Folder dziala jak kolekcja tras z wspolna okladka i opisem.

---

## 1. Zmiany w bazie danych

### 1.1 Nowa tabela `route_folders`

```sql
CREATE TABLE public.route_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,                    -- np. "JAPONIA"
  description text,                      -- opis folderu
  cover_image_url text,                  -- okladka
  folder_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 1.2 Nowa kolumna w `routes`

```sql
ALTER TABLE public.routes
ADD COLUMN folder_id uuid REFERENCES public.route_folders(id) ON DELETE SET NULL,
ADD COLUMN folder_order integer DEFAULT 0;
```

- `folder_id` jest nullable - trasy bez folderu dzialaja jak dotychczas
- `folder_order` okresla kolejnosc dnia w folderze (0 = Dzien 1, 1 = Dzien 2...)
- `ON DELETE SET NULL` - usuniecie folderu nie kasuje tras, tylko je "odczepia"

### 1.3 RLS

```sql
-- Foldery widoczne publicznie (jak trasy published)
-- Wlasciciel widzi wszystkie swoje
-- Inni widza foldery z co najmniej 1 opublikowana trasa
ALTER TABLE route_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Folder owner full access" ON route_folders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public folders viewable" ON route_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.folder_id = route_folders.id 
      AND routes.status = 'published'
    )
  );
```

### 1.4 Diagram relacji

```text
route_folders (1) ----< (N) routes
     |                        |
     +-- id                   +-- folder_id (nullable FK)
     +-- user_id              +-- folder_order
     +-- name                 +-- title (np. "Dzien 1 - Tokio")
     +-- description          +-- ...existing columns
     +-- cover_image_url
```

---

## 2. Nowe komponenty UI

### 2.1 Karta folderu - `FolderCard.tsx`

Wyswietlana na liscie "Moje Trasy" i profilu uzytkownika:

```text
+---------------------------------------+
| [Okladka folderu - full width]        |
|                                       |
|  JAPONIA                              |
|  "2 tygodnie w Kraju Kwitnacych..."   |
|                                       |
|  [Dzien 1] [Dzien 2] [Dzien 3] +4    |  <- mini-chips z dniami
|                                       |
|  5 tras  |  23 pinezki  |  4.8 ★     |
+---------------------------------------+
```

Klikniecie otwiera widok folderu.

### 2.2 Widok folderu - `FolderDetails.tsx`

Nowa strona `/folder/:id` z lista tras-dni:

```text
+---------------------------------------+
| <- Powrot          [Edytuj] [Udostep] |
+---------------------------------------+
| [Okladka]                             |
| JAPONIA                               |
| 14 dni  |  67 pinezek  |  4.7 ★      |
+---------------------------------------+
|                                       |
| Dzien 1 - Tokio              4.8 ★   |
|   8 pinezek  |  Opublikowana         |
|                                       |
| Dzien 2 - Kamakura           4.5 ★   |
|   5 pinezek  |  Opublikowana         |
|                                       |
| Dzien 3 - Kioto              4.9 ★   |
|   6 pinezek  |  Robocza [draft]      |
|                                       |
| [+ Dodaj kolejny dzien]              |
+---------------------------------------+
```

### 2.3 Tworzenie folderu - `CreateFolder.tsx` lub modal

Prosty formularz:
- Nazwa folderu (np. "JAPONIA")
- Opis (opcjonalny)
- Okladka (opcjonalna)
- Wybor istniejacych tras do dodania (opcjonalny)

---

## 3. Modyfikacje istniejacych komponentow

### 3.1 `MyRoutes.tsx` - nowy tab "Foldery"

Obecne taby: `Opublikowane` | `Robocze`

Po zmianie: `Opublikowane` | `Robocze` | `Foldery`

Tab "Foldery" wyswietla liste `FolderCard` + przycisk "Nowy folder".

Trasy przypisane do folderu moga byc ukryte z glownej listy (lub oznaczone ikona folderu).

### 3.2 `CreateRoute.tsx` - przypisanie do folderu

Dodanie opcjonalnego selecta "Dodaj do folderu" na kroku 1 (metadane trasy):

```text
Tytul trasy: [Dzien 1 - Tokio        ]
Opis:        [Swiatynie i ogrody...   ]
Folder:      [JAPONIA            ▼]  <- dropdown z folderami usera
```

Jesli user wybierze folder, trasa automatycznie dostaje `folder_order` = nastepny numer.

### 3.3 `RouteDetails.tsx` - breadcrumb do folderu

Jesli trasa nalezy do folderu, nad tytulem pojawia sie link:

```text
JAPONIA > Dzien 2 - Kamakura
```

### 3.4 `RouteCard.tsx` - badge folderu

Jesli trasa jest czescia folderu, na karcie pojawia sie maly badge:

```text
[Folder] JAPONIA - Dzien 2
```

### 3.5 `BottomNav.tsx` / `CreateModeDrawer.tsx`

Opcja "Nowy folder" obok "Nowa trasa" w drawerze tworzenia.

---

## 4. Routing

Nowe sciezki w `App.tsx`:

```typescript
<Route path="/folder/:id" element={<AppLayout><FolderDetails /></AppLayout>} />
<Route path="/create-folder" element={<CreateFolder />} />
<Route path="/edit-folder/:id" element={<CreateFolder />} />
```

---

## 5. Zachowanie zapisanych tras

`SavedRoutes.tsx` - mozliwosc zapisania calego folderu (nowa tabela `saved_folders` lub grupowanie zapisanych tras po folderze).

---

## 6. Podsumowanie plikow

| Plik | Zmiana |
|------|--------|
| `supabase/migrations/[nowa].sql` | Tabela `route_folders`, kolumny w `routes`, RLS |
| `src/components/route/FolderCard.tsx` | NOWY - karta folderu |
| `src/pages/FolderDetails.tsx` | NOWY - widok szczegolowy folderu |
| `src/pages/CreateFolder.tsx` | NOWY - tworzenie/edycja folderu |
| `src/pages/MyRoutes.tsx` | Nowy tab "Foldery" |
| `src/pages/CreateRoute.tsx` | Dropdown "Dodaj do folderu" |
| `src/pages/RouteDetails.tsx` | Breadcrumb do folderu |
| `src/components/route/RouteCard.tsx` | Badge folderu |
| `src/components/route/CreateModeDrawer.tsx` | Opcja "Nowy folder" |
| `src/App.tsx` | Nowe routy |

---

## 7. Wazne decyzje projektowe

**Folder vs. "Multi-day Route"**: Folder to luzna kolekcja tras - kazdy dzien to oddzielna, pelna trasa z wlasnymi pinami, notatkami, ocenami. Nie ma jednej "super-trasy" - folder tylko grupuje.

**Widocznosc**: Folder jest widoczny publicznie jesli zawiera co najmniej 1 opublikowana trase. Robocze trasy w folderze widzi tylko wlasciciel.

**Kompatybilnosc**: Istniejace trasy dzialaja bez zmian (`folder_id = NULL`). Folder jest calkowicie opcjonalny.

**Kolejnosc dni**: `folder_order` na trasach pozwala na drag-and-drop reorderowanie dni w folderze (analogicznie do obecnego DraggablePinList).

