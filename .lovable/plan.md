

## Napraw generowanie linku dla istniejących użytkowników

### Problem
Edge function `invite-user` wywołuje `generateLink({ type: "invite" })`, które zwraca 422 gdy email już istnieje w `auth.users`. Użytkownik `989898mon@gmail.com` ma już konto, więc nie można go "zaprosić" ponownie.

### Rozwiązanie
W `invite-user` edge function dodać fallback: jeśli `generateLink` z `type: "invite"` zwróci błąd `email_exists`, spróbować wygenerować link typu `magiclink` zamiast tego. Magic link pozwoli użytkownikowi zalogować się i ustawić hasło.

### Plik do edycji
`supabase/functions/invite-user/index.ts`

### Zmiany
1. Po wywołaniu `generateLink({ type: "invite" })`, jeśli błąd zawiera "already been registered":
   - Wywołaj `generateLink({ type: "magiclink", email, options: { redirectTo: "https://trasa.lovable.app/set-password" } })`
   - Zwróć wygenerowany link tak samo jak dla nowego użytkownika
2. Pomiń tworzenie profilu i aktualizację waitlist jeśli użytkownik już istnieje (profil prawdopodobnie już jest)

### Alternatywa
Jeśli wolisz po prostu usunąć tego użytkownika z `auth.users` i zaprosić go od nowa — mogę to zrobić ręcznie przez panel Supabase. Ale fix w kodzie jest lepszy długoterminowo, bo ten problem może się powtórzyć.

