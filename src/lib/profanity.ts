// Wulgaryzmy i obelgi - JEDNO zrodlo prawdy dla nazw uzytkownika i tytulow list (2026-09-08).
//
// Powstalo z `usernameRules.ts`, bo ten sam problem wrocil przy listach miejsc: user moze
// nazwac publiczna liste "najlepsze kurwy w Krakowie" i wystawic to na eksploracje.
// Bariera twarda siedzi w bazie (wyzwalacze + tabela `banned_usernames`); tutaj jest kopia
// dla natychmiastowej informacji zwrotnej przy pisaniu.
//
// Roznica miedzy nazwa a tytulem listy jest istotna: nazwa uzytkownika to JEDEN wyraz bez
// spacji, wiec porownujemy ja w calosci; tytul listy to zdanie, wiec slowa krotkie
// ("sex", "ass") musimy dopasowywac jako CALE WYRAZY - inaczej "Essex" albo "Cassandra"
// wyladowalyby na cenzurze.

/** Znaki, ktorymi podmienia sie litery, zeby ominac filtr ("n1gger", "ch@j"). */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "l", "(": "c",
};
const PL_DIACRITICS: Record<string, string> = {
  "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
};

// Slowa blokowane GDZIEKOLWIEK w tresci - nie wystepuja przypadkiem w niewinnym tekscie.
export const BANNED_SUBSTRING = [
  // angielski
  "nigger", "nigga", "faggot", "cunt", "motherfuck", "fuck", "whore", "slut",
  "bitch", "pussy", "rapist", "pedophile", "pedofil", "porn", "hitler", "holocaust",
  // polski
  "kurwa", "kurwy", "jebac", "jeban", "jebie", "pierdol", "pierdal", "spierdal", "wypierdal",
  "chuj", "chuja", "chuje", "pizda", "pizdy", "skurwysyn", "cwel", "kutas",
  // odmiana: filtr dziala na tekscie, a nie na jednym wyrazie, wiec musi znac formy
  "dupa", "dupe", "dupy", "dupsko", "kurwe", "kurwie", "kurew",
  "murzyn", "ciota", "pedal", "debil", "kretyn", "zjeb", "pojeb", "gowno", "szmata",
];

// Slowa krotkie albo takie, ktore siedza w srodku niewinnych wyrazow ("Cassandra",
// "Dickinson", "Hancock", "analityk", "Essex"). Dopasowujemy je jako CALE WYRAZY.
export const BANNED_EXACT = [
  "ass", "fag", "dick", "cock", "anal", "sex", "shit", "nazi", "rape", "retard",
  "suka", "cipa", "huj", "sperma", "penis", "wagina",
];

/**
 * Postac do POROWNAN (nie do wyswietlania) dla JEDNEGO wyrazu - bez spacji, bez znakow
 * specjalnych. Dwa warianty, bo te same znaki sluza do dwoch sztuczek: raz cyfra UDAJE
 * litere ("n1gg3r"), raz ROZDZIELA litery ("n1gg$er"). Zaden sam nie wystarcza.
 * Musi dawac to samo, co normalize_username_for_match w bazie.
 */
export function normalizeForMatch(raw: string, substitute = true): string {
  return raw
    .toLowerCase()
    .split("").map((c) => PL_DIACRITICS[c] ?? (substitute ? LEET[c] ?? c : c)).join("")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Jak wyzej, ale dla ZDANIA: znaki spoza alfabetu staja sie spacja zamiast znikac, wiec
 * granice wyrazow przezywaja normalizacje. Bez tego "Essex" i "es sex" byly nierozroznialne.
 */
export function normalizeTextForMatch(raw: string, substitute = true): string {
  return raw
    .toLowerCase()
    .split("").map((c) => PL_DIACRITICS[c] ?? (substitute ? LEET[c] ?? c : c)).join("")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Czy tekst (tytul listy, opis, nazwa wyjazdu) zawiera wulgaryzm albo obelge.
 *
 * Sprawdzamy trzy postacie tego samego napisu, bo kazda lapie inna sztuczke:
 *   1. z podmiana cyfr na litery      - "n4jlepsze kurwy", "n1gg3r",
 *   2. bez podmiany                   - "n1gg$er" (znak ROZDZIELA litery),
 *   3. bez ZADNYCH znakow rozdzielajacych - "k.u.r.w.y", "k u r w y".
 * Wariant 3 tylko dla listy "gdziekolwiek": po sklejeniu wszystkiego w jeden ciag nie ma
 * juz granic wyrazow, wiec dopasowanie krotkich slow dawaloby falszywe alarmy.
 *
 * Swiadome ograniczenie: filtr slownikowy nie zlapie maskowania samoglosek ("ch*j") - od
 * tego jest moderacja list publicznych i zglaszanie tresci, nie ta funkcja.
 */
export function containsProfanity(raw: string): boolean {
  if (!raw) return false;
  for (const substitute of [true, false]) {
    const n = normalizeTextForMatch(raw, substitute);
    if (!n) continue;
    if (BANNED_SUBSTRING.some((w) => n.includes(w))) return true;
    if (n.split(" ").some((w) => BANNED_EXACT.includes(w))) return true;
    const glued = n.replace(/ /g, "");
    if (BANNED_SUBSTRING.some((w) => glued.includes(w))) return true;
  }
  return false;
}
