-- `group_sessions.city` przestaje byc NOT NULL (2026-09-16).
--
-- Od 2026-09-10 zasiegiem wyjazdu jest KRAJ i `routes.city` bywa NULL (kreator wybiera
-- wylacznie kraje), a zaproszenie do wyjazdu zakladalo sesje grupowa z `city` przepisanym
-- wprost z trasy. Konczylo sie to bledem 23502 i komunikatem "Nie udalo sie zaprosic":
-- przez pieć dni nie dalo sie zaprosic NIKOGO do nowo utworzonego wyjazdu.
--
-- Klient juz tego nie wysyla (poprawka 8bf73f0b, 15.09: `city: route.city ?? ""`), ALE ta
-- poprawka dziala dopiero po wgraniu nowego builda. Testerzy na TestFlight siedza na starszej
-- wersji jeszcze dlugo po tym, jak naprawa trafi do repo - i faktycznie dalej im sie wywalalo
-- (logi 16.09 11:17-11:19). Zdjecie NOT NULL naprawia to dla WSZYSTKICH istniejacych instalacji
-- od razu, bez czekania na aktualizacje.
--
-- Czy kolumna jest do czegos potrzebna: nie. To pozostalosc po starym parowaniu grupowym
-- (zdjete 2026-08-06), ktore czytalo z niej miasto do losowania puli miejsc. Jedyne miejsce,
-- ktore ja jeszcze wyswietla (`ActiveTripsDashboard`), i tak ma `s.name` z tytulem wyjazdu
-- i pomija puste miasto. Nowe wiersze dostaja pusty string albo NULL - obie wartosci sa tam
-- rownie nieistotne.

ALTER TABLE public.group_sessions ALTER COLUMN city DROP NOT NULL;
