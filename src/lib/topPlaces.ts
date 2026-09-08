// "Topka" wyjazdu - miejsca wyroznione przez autora (2026-09-08).
//
// Wybor jest RECZNY (decyzja Nat): autor wskazuje to, co warto polecic, zamiast liczyc
// sredniej z ocen. W wyjezdzie wspolnym "top" moglby znaczyc "najwyzej oceniane przez
// grupe", ale to inna funkcja - tutaj chodzi o rekomendacje autora.

/**
 * Ile miejsc wolno wyroznic. Rosnie z dlugoscia trasy, bo trzy gwiazdki przy trzech
 * miejscach nie wyrozniaja niczego - wyroznienie ma sens tylko wtedy, gdy zostawia reszte
 * w tle. Przy krotkiej trasie jedna gwiazdka, przy dluzszej maksymalnie trzy.
 */
export function topLimit(placeCount: number): number {
  if (placeCount <= 3) return 1;
  if (placeCount <= 7) return 2;
  return 3;
}
