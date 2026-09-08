// "Topka" wyjazdu - JEDNO miejsce wyroznione przez uczestnikow (2026-09-08).
//
// Wybor jest RECZNY (decyzja Nat): wskazujemy to, co warto polecic, zamiast liczyc sredniej
// z ocen. Poczatkowo limit rosl z dlugoscia trasy (1-3 gwiazdki), ale Nat zdecydowala, ze
// wyroznienie ma byc JEDNO na caly wyjazd - trzy "najlepsze" miejsca to juz nie wyroznienie,
// tylko druga lista.
//
// Konsekwencja dla interfejsu: tapniecie w gwiazdke przy innym miejscu PRZENOSI wyroznienie,
// zamiast odmawiac z komunikatem "masz juz komplet". Przy limicie 1 kazdy inny wybor to
// zmiana zdania, a nie blad - wiec nie ma czego blokowac.
export const TOP_LIMIT = 1;
