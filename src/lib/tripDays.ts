// Maksymalna dlugosc wyjazdu w kalendarzu (kreator wyjazdu + zmiana dat w widoku wyjazdu).
//
// Do 2026-09-13 bylo 14 dni; Nat zdjela limit "na sztywno", ale zostawila bezpiecznik
// ~3 miesiace - zakres bez sufitu zaprasza do zaznaczenia roku przez przypadek (i do
// naduzyc), a 92 dni mieszcza kazdy realny wyjazd. Jedno miejsce, zeby oba kalendarze
// zgadzaly sie co do dnia.
export const MAX_TRIP_DAYS = 92;
