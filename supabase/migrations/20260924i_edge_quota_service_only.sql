-- LICZNIK PROXY OBRAZKOW PRZESZEDL NA KLUCZ SERWISOWY (2026-09-24, potwierdzone na prodzie).
--
-- Nat dodala `SUPABASE_SERVICE_ROLE_KEY` do zmiennych Vercela, wiec `api/_quota.ts` wola teraz
-- `try_consume_rate_limit` - funkcje dostepna WYLACZNIE dla service_role. Sprawdzone wprost:
-- po odebraniu anonowi dostepu do funkcji zapasowej licznik dalej rosl (5 -> 8 po trzech
-- zadaniach), a wywolanie `try_consume_edge_quota` kluczem anon oddaje 42501.
--
-- Dlatego zamykamy publiczna furtke: funkcja zapasowa (bez tokenu, z migracji 20260924h)
-- przestaje byc wolywalna przez anon i authenticated. Zostaje w bazie jako awaryjne wyjscie,
-- gdyby klucz serwisowy kiedys zniknal ze zmiennych - wtedy wystarczy przywrocic GRANT,
-- a kod sam z niej skorzysta.
--
-- ⛔ Od teraz NIKT z zewnatrz nie moze ani ominac limitu, ani nabic go nam na zlosc.

REVOKE EXECUTE ON FUNCTION public.try_consume_edge_quota(text, integer, integer) FROM anon, authenticated;
