// Gwiazdka przy miejscu ("topka") - BEZ LIMITU w wyjazdach i kolekcjach (decyzja Nat 2026-09-14).
//
// Historia: 2026-09-08 jedna gwiazdka na caly wyjazd (kolejny wybor PRZENOSIL wyroznienie),
// 2026-09-13 kolekcje bez limitu, 2026-09-14 wyjazdy tez bez limitu - user wyroznia tyle miejsc,
// ile chce. Wybor pozostaje RECZNY (nie liczymy sredniej z ocen).
//
// Plik zostaje jako jedno miejsce na te decyzje; stala TOP_LIMIT nie istnieje. Od 2026-09-20/21
// gwiazdki sa PER UCZESTNIK: SharedList pisze do `discovery_item_stars` (collectionStars.ts),
// SharedRoute do `pin_stars` (tripStars.ts); `is_top` na pozycji/pinie = gwiazdka wlasciciela.
export {};
