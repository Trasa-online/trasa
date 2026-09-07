// Reguly nazwy uzytkownika - JEDNO zrodlo prawdy dla onboardingu i Ustawien (2026-09-07).
//
// Powod: tester zmienil sobie nazwe na "berd " (spacja na koncu) i podszyl sie pod admina,
// bo ekran Ustawien w ogole nie sprawdzal dostepnosci, a UNIQUE w bazie porownuje bajt w bajt.
// Sama walidacja po stronie klienta niczego nie gwarantuje - twarde bariery (unikalnosc bez
// wzgledu na wielkosc liter, przyciecie spacji, lista zakazanych slow) siedza w bazie
// (migracja 20260907b). Tutaj jest to samo, zeby user zobaczyl blad OD RAZU przy pisaniu,
// a nie dopiero po tapnieciu "Zapisz".

/** Znaki, ktorymi podmienia sie litery, zeby ominac filtr ("n1gger", "ch@j"). */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "l", "(": "c",
};
const PL_DIACRITICS: Record<string, string> = {
  "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
};

/**
 * Postacie do POROWNAN (nie do wyswietlania). Dwa warianty, bo te same znaki sluza do
 * dwoch roznych sztuczek: raz cyfra UDAJE litere ("n1gg3r"), raz ROZDZIELA litery
 * ("n1gg$er"). Podmiana lapie pierwsza, usuniecie druga - zaden wariant sam nie wystarcza.
 * Musi dawac to samo, co normalize_username_for_match w bazie (migracja 20260907b).
 */
export function normalizeForMatch(raw: string, substitute = true): string {
  return raw
    .toLowerCase()
    .split("").map((c) => PL_DIACRITICS[c] ?? (substitute ? LEET[c] ?? c : c)).join("")
    .replace(/[^a-z0-9]/g, "");
}

// Wulgaryzmy i obelgi, ktore blokujemy GDZIEKOLWIEK w nazwie - te slowa nie wystepuja
// przypadkiem w srodku normalnego nicku.
const BANNED_SUBSTRING = [
  // angielski
  "nigger", "nigga", "faggot", "cunt", "motherfuck", "fuck", "whore", "slut",
  "bitch", "pussy", "rapist", "pedophile", "pedofil", "porn", "hitler", "holocaust",
  // polski
  "kurwa", "kurwy", "jebac", "jeban", "jebie", "pierdol", "pierdal", "spierdal", "wypierdal",
  "chuj", "chuja", "chuje", "pizda", "pizdy", "skurwysyn", "cwel", "kutas", "dupa",
  "murzyn", "ciota", "pedal", "debil", "kretyn", "zjeb", "pojeb", "gowno", "szmata",
];

// Slowa krotkie albo takie, ktore normalnie siedza w srodku niewinnych nazw
// ("Cassandra", "Dickinson", "Hancock", "analityk"): blokujemy tylko gdy nazwa to
// DOKLADNIE to slowo.
const BANNED_EXACT = [
  "ass", "fag", "dick", "cock", "anal", "sex", "shit", "nazi", "rape", "retard",
  "suka", "cipa", "huj", "sperma", "penis", "wagina",
];

// Nazwy zastrzezone: konto oficjalne albo rola. Nie chodzi o wulgarnosc, tylko o to,
// zeby nikt nie podawal sie za nas ani za obsluge.
const RESERVED = [
  "admin", "administrator", "moderator", "mod", "support", "pomoc", "help",
  "spontaway", "trasa", "official", "oficjalne", "system", "root", "staff", "team",
  "kontakt", "contact", "info", "obsluga", "security",
];

/**
 * Postac do ZAPISU: bez znakow niewidzialnych, ze zwyklymi spacjami, przycieta.
 * Znak zerowej szerokosci albo spacja nielamiaca wygladaja na ekranie jak nic (albo jak
 * zwykla spacja), a dla bazy robily z "berd" inna nazwe - tak wlasnie da sie podszyc pod
 * cudze konto. To samo robi wyzwalacz normalize_profile_names (migracja 20260907b).
 */
export function cleanUsername(raw: string): string {
  return raw
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 20;

export type UsernameProblem = "empty" | "short" | "long" | "chars" | "banned" | "reserved";

/**
 * Sprawdza SAMA nazwe (bez zapytania do bazy). Zwraca null, gdy nazwa jest w porzadku.
 * Dostepnosc to osobna sprawa - patrz `isUsernameTaken`.
 */
export function checkUsername(raw: string): UsernameProblem | null {
  const value = cleanUsername(raw);
  if (!value) return "empty";
  if (value.length < USERNAME_MIN) return "short";
  if (value.length > USERNAME_MAX) return "long";
  // Litery (takze polskie), cyfry, kropka, podkreslenie, myslnik i POJEDYNCZA spacja
  // w srodku - taka maja historyczne konta lokali. Spacje na brzegach znikaja w
  // cleanUsername, bo to wlasnie spacja na koncu pozwolila podszyc sie pod cudze konto.
  if (!/^[\p{L}\p{N}._-]+( [\p{L}\p{N}._-]+)*$/u.test(value)) return "chars";

  const forms = [normalizeForMatch(value, true), normalizeForMatch(value, false)];
  if (!forms[0]) return "chars";
  if (forms.some((n) => RESERVED.includes(n))) return "reserved";
  if (forms.some((n) => BANNED_EXACT.includes(n))) return "banned";
  if (forms.some((n) => BANNED_SUBSTRING.some((w) => n.includes(w)))) return "banned";
  return null;
}

/** Klucz porownania nazw: bez wielkosci liter i bez spacji na brzegach - tak jak w bazie. */
export const usernameKey = (raw: string) => cleanUsername(raw).toLowerCase();

/** "%" i "_" maja w LIKE znaczenie specjalne, a w nazwie uzytkownika to zwykle znaki. */
export const escapeLike = (v: string) => v.replace(/[%_\\]/g, "\\$&");
