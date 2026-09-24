/**
 * Bezpiecznik dla skryptow, ktore bija w PLATNE SKU Google Places.
 *
 * ⛔ Powod (2026-09-22): caly nasz rachunek za wrzesien (36,28 zl) to NIE byla wyszukiwarka
 * w apce - 2081 wywolan Text Search zmiescilo sie w darmowej puli 5000/mies. Zaplacilismy
 * za dwa SKU o smiesznie malej puli 1000 wywolan miesiecznie:
 *   - Place Details z atmosfera (recenzje, godziny): 25 $ / 1000
 *   - Places Photo: 7 $ / 1000
 * Wywolywal je pipeline okladek - i z apki, i z tych skryptow, odpalanych "przy okazji".
 *
 * Skrypt z tym bezpiecznikiem NIE ODPALI SIE przypadkiem. Zeby go uruchomic swiadomie:
 *   GOOGLE_PAID_OPS=1 npx tsx scripts/<nazwa>.ts
 */
export function requirePaidGoogleOps(what: string): void {
  if (process.env.GOOGLE_PAID_OPS === "1") {
    console.warn(`[platne-google] ${what}: jedziemy (GOOGLE_PAID_OPS=1). Pamietaj o limicie 1000 darmowych wywolan/mies.`);
    return;
  }
  console.error(
    `\n⛔ ${what} wola PLATNE Google Places API i dlatego jest zablokowany.\n` +
    `   Darmowa pula to 1000 wywolan miesiecznie na SKU - ten skrypt potrafi ja zjesc w kilka minut.\n` +
    `   Jesli naprawde chcesz go uruchomic:\n\n` +
    `     GOOGLE_PAID_OPS=1 npx tsx ${process.argv[1]?.split("/").slice(-2).join("/") ?? "scripts/<skrypt>.ts"}\n`,
  );
  process.exit(1);
}
