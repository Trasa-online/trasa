-- WYCIEK: ROBOCZE wyjazdy grupowe byly widoczne PUBLICZNIE (2026-09-16).
--
-- Zgloszenie Nat: "na profilach publicznych widze robocze wyjazdy". Sprawdzone na prodzie
-- kluczem ANONIMOWYM (bez logowania): trzy szkice wracaly z `GET /rest/v1/routes`, razem
-- z pinami - czyli caly plan podrozy, ktory nigdy nie zostal opublikowany.
--
-- Skad: polityka `Public can read shared routes` powstala, gdy `is_shared` BYLO publikacja.
-- Od 2026-08-23 publikacja to `status = 'published'` (migracja modelu roboczy->przeszly),
-- ale polityki nikt wtedy nie ruszyl. Rownoczesnie `inviteUsersToRoute` ustawia
-- `is_shared = true` KAZDEMU wyjazdowi grupowemu, takze roboczemu - wiec od chwili
-- zaproszenia pierwszej osoby szkic stawal sie publiczny.
--
-- Dlaczego zaproszeni NIE traca dostepu: czytaja przez wlasne polityki po czlonkostwie
-- (`Group members can read shared routes` / `Group members can see group routes`, warunek
-- na `group_session_id`, bez `is_shared`), a wlasciciel przez `Owner can read own routes`.
-- Sprawdzone na prodzie w `BEGIN … ROLLBACK`: po zmianie anon widzi 0 szkicow zamiast 3,
-- 10 opublikowanych bez zmian, a czlonek grupy (nie wlasciciel, nie admin) nadal czyta swoj
-- roboczy wyjazd grupowy.
--
-- ⚠️ Komentarz w `groupInvite.ts` ("brak RLS czlonkostwa na routes -> inaczej zaproszeni jej
-- nie odczytaja") byl NIEAKTUALNY - te polityki istnieja. `is_shared` zostaje na wyjezdzie
-- grupowym, bo czyta je reszta kodu, ale nie jest juz przepustka do publicznego odczytu.

ALTER POLICY "Public can read shared routes" ON public.routes
  USING (is_shared = true AND status = 'published' AND deleted_at IS NULL);
