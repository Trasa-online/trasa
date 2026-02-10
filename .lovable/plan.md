

## Zamiana zakładki "Ustawienia" na "Profil" w nawigacji dolnej

### Zmiany

**1. `src/components/layout/BottomNav.tsx`**
- Import `useAuth` z `@/hooks/useAuth`
- Import ikony `User` zamiast `Settings` z lucide-react
- Zamiana ostatniej zakładki:
  - Link: `/profile/${user?.id}` (dynamiczny) lub `/auth` jako fallback gdy niezalogowany
  - Ikona: `User`
  - Label: "Profil"
  - Aktywny stan: dopasowanie do `/profile/`

**2. `src/pages/Profile.tsx`**
- Dodanie przycisku ustawień (ikona Settings) w `rightAction` PageHeader -- widoczny tylko gdy użytkownik ogląda swój własny profil (`user?.id === userId`)
- Kliknięcie przekieruje na `/settings`

**3. `src/pages/Settings.tsx`**
- Dodanie `PageHeader` z `showBack` zamiast zwykłego `<h1>`, żeby użytkownik mógł wrócić do profilu

### Efekt
- Dolna nawigacja: Feed | Trasy | + | Zapisane | **Profil**
- Kliknięcie "Profil" otwiera profil zalogowanego użytkownika
- Na swoim profilu widoczna ikona ustawień (koło zębate) w headerze
- Ustawienia dostępne jako podstrona z przyciskiem "wstecz"

