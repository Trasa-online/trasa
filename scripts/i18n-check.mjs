#!/usr/bin/env node
// Bramka dwujezycznosci (2026-09-06). Odpalana w `npm run check:both`, wiec nie da sie
// wypchnac zmiany, ktora psuje angielski. Sprawdza CZTERY rzeczy:
//
//  1. PARZYSTOSC KLUCZY pl <-> en. Klucz bez pary to ekran, ktory po angielsku spada na
//     polski tekst (fallbackLng: "pl") i wyglada jak przetlumaczony.
//  2. FORMY LICZBY MNOGIEJ. Polski ma one/few/many, angielski one/other. Wpisanie polskich
//     sufiksow do en/*.json (tak bylo do 2026-09-06) sprawia, ze KAZDA liczba != 1 pokazuje
//     po angielsku polski tekst - i tego nie widac w statystyce pokrycia.
//  3. POLSKI TEKST ZAPASOWY w t(): `t("klucz", "Polski")` albo `defaultValue: "Polski"`.
//     Dziala po polsku, po angielsku pokazuje polski. Klucz ma zyc w plikach, nie w kodzie.
//  4. POLSKI NA SZTYWNO w nowym kodzie - literaly i tekst JSX z polskimi znakami
//     diakrytycznymi. Pliki z dlugiem historycznym sa na liscie w i18n-baseline.json;
//     lista moze tylko malec (nowy plik na niej = blad).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOC = path.join(ROOT, "src/locales");
const BASELINE = path.join(ROOT, "scripts/i18n-baseline.json");
const PL_DIA = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// Duzo polskiego copy nie ma ani jednego znaku diakrytycznego ("Ten profil jest zablokowany",
// "Brak wyjazdow", "Dodaj miejsce"). Sam ogonek nie wystarczy jako sygnal, wiec drugim testem
// jest slownik slow, ktore po angielsku nie wystepuja. Krotkie zbieznosci (to, i, a, list)
// celowo pominiete - falszywy alarm w bramce jest gorszy niz jeden przeoczony napis.
const PL_WORDS = /(?:^|[^\p{L}])(?:jest|nie|sie|się|tego|tej|tym|ten|ta|twoj|twój|twoja|twoje|masz|dodaj|usun|usuń|zapisz|wybierz|brak|pokaz|pokaż|wiecej|więcej|jeszcze|tutaj|teraz|gdzie|kiedy|zeby|żeby|przez|bez|juz|już|tylko|wszystko|miejsce|miejsca|miejsc|wyjazd|wyjazdy|wyjazdu|trasa|trasy|lista|listy|zdjecie|zdjęcie|zdjecia|zdjęcia|uzytkownik|użytkownik|profil|wroc|wróć|dalej|gotowe|anuluj|zamknij|edytuj|szukaj|nowy|nowa|nowe|moje|jako|albo|oraz|czy|jak|co)(?:[^\p{L}]|$)/iu;
const looksPolish = (s) => PL_DIA.test(s) || PL_WORDS.test(s);
const PLURAL = /_(zero|one|two|few|many|other)$/;
const errors = [];
const warn = [];

const flat = (o, p = "") => Object.entries(o).reduce((acc, [k, v]) => {
  const kk = p ? `${p}.${k}` : k;
  if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(acc, flat(v, kk));
  else acc[kk] = v;
  return acc;
}, {});

// ── 1 + 2: pliki tlumaczen ───────────────────────────────────────────────────
const namespaces = fs.readdirSync(path.join(LOC, "pl")).filter((f) => f.endsWith(".json"));
for (const file of namespaces) {
  const ns = file.replace(/\.json$/, "");
  const enPath = path.join(LOC, "en", file);
  if (!fs.existsSync(enPath)) { errors.push(`[${ns}] brak pliku en/${file}`); continue; }
  const pl = flat(JSON.parse(fs.readFileSync(path.join(LOC, "pl", file), "utf8")));
  const en = flat(JSON.parse(fs.readFileSync(enPath, "utf8")));

  // Klucze z liczba mnoga porownujemy grupami, bo formy sa inne w kazdym jezyku.
  const bases = (obj) => new Set(Object.keys(obj).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, "")));
  const plB = bases(pl), enB = bases(en);
  const plain = (obj, b) => Object.keys(obj).filter((k) => !PLURAL.test(k) || !b.has(k.replace(PLURAL, "")));

  for (const k of plain(pl, plB)) if (!(k in en)) errors.push(`[${ns}] klucz bez wersji EN: ${k}`);
  for (const k of plain(en, enB)) if (!(k in pl)) errors.push(`[${ns}] klucz bez wersji PL: ${k}`);

  for (const b of new Set([...plB, ...enB])) {
    const forms = (obj) => new Set(Object.keys(obj).filter((k) => k.replace(PLURAL, "") === b && PLURAL.test(k)).map((k) => k.match(PLURAL)[1]));
    const fp = forms(pl), fe = forms(en);
    for (const need of ["one", "few", "many"]) if (fp.size && !fp.has(need)) errors.push(`[${ns}] PL ${b}: brak formy _${need} (polski ma one/few/many)`);
    for (const need of ["one", "other"]) if (fe.size && !fe.has(need)) errors.push(`[${ns}] EN ${b}: brak formy _${need} (angielski ma one/other)`);
    for (const bad of ["few", "many"]) if (fe.has(bad)) errors.push(`[${ns}] EN ${b}: forma _${bad} nigdy sie nie dopasuje po angielsku`);
  }
}

// ── 3 + 4: kod ───────────────────────────────────────────────────────────────
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "locales") walk(p, acc); }
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
};

// Zdejmuje komentarze, zeby polskie objasnienia w kodzie (a jest ich duzo) nie zglaszaly sie
// jako napisy do przetlumaczenia. Sledzi stan stringow, wiec "https://" nie znika.
// Apostrof w tekscie JSX ("toggle'a", "don't") NIE otwiera napisu - inaczej maszyna stanow
// gubi synchronizacje i pochlania caly dalszy plik razem z polskimi napisami, ktore mial
// znalezc. Napis moze zaczac sie tylko tam, gdzie w skladni ma prawo stac.
const OPENS_STRING = new Set(["(", "=", ",", ":", "[", "{", "+", "?", "|", "&", ";", "!", "<", ">", " ", "\t", "\n", "\r", ""]);
// Wyjatki dla DANYCH (nazwy wlasne miast, krajow, tagi), ktore w obu jezykach brzmia tak samo:
//   `// i18n-ignore` na koncu linii  - pomija te jedna linie,
//   `// i18n-ignore-start` ... `// i18n-ignore-end` - pomija caly blok (dlugie slowniki).
// To furtka dla danych, NIE dla copy, ktore po prostu nie zostalo jeszcze przetlumaczone -
// od tego jest baseline.
function maskIgnored(raw) {
  let skipping = false;
  return raw.split("\n").map((l) => {
    if (l.includes("i18n-ignore-start")) { skipping = true; return ""; }
    if (l.includes("i18n-ignore-end")) { skipping = false; return ""; }
    return skipping || l.includes("i18n-ignore") ? "" : l;
  }).join("\n");
}

function stripComments(src) {
  let out = "", i = 0, mode = null, prev = "";
  // Czy napis otwarty tym cudzyslowem konczy sie w TEJ SAMEJ linii? Napisy w " i ' nie
  // przechodza do nastepnej linii, wiec niesparowany cudzyslow w tekscie JSX (polskie
  // „cytat") to zwykly znak, a nie poczatek napisu. Bez tego sprawdzenia maszyna stanow
  // gubila synchronizacje i pochlaniala reszte pliku razem z komentarzami.
  const closesOnLine = (q, from) => {
    for (let j = from; j < src.length; j++) {
      if (src[j] === "\\") { j++; continue; }
      if (src[j] === "\n") return false;
      if (src[j] === q) return true;
    }
    return false;
  };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (mode === null) {
      if (c === "/" && n === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; i += 2; continue; }
      if (c === "`" || ((c === '"' || (c === "'" && OPENS_STRING.has(prev))) && closesOnLine(c, i + 1))) {
        mode = c; out += c; prev = c; i++; continue;
      }
      out += c; if (c.trim() || c === " " || c === "\n") prev = c; i++; continue;
    }
    if (mode === "line") { if (c === "\n") { mode = null; out += c; prev = c; } i++; continue; }
    if (mode === "block") { if (c === "*" && n === "/") { mode = null; i += 2; continue; } i++; continue; }
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    out += c;
    if (c === mode) { mode = null; prev = c; }
    i++;
  }
  return out;
}

// Ten sam warunek przy wyszukiwaniu literalow - regex bez tego zaczyna napis na apostrofie
// w srodku slowa i zwraca smieci albo nie zwraca nic.
function literals(src) {
  const found = [];
  let i = 0, prev = "";
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "`" || (c === "'" && OPENS_STRING.has(prev))) {
      let j = i + 1, buf = "";
      while (j < src.length) {
        if (src[j] === "\\") { buf += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === c) break;
        // Napis w apostrofach/cudzyslowie NIE przechodzi do nastepnej linii. Bez tego jeden
        // niesparowany cudzyslow w tekscie JSX (np. polskie „cytat") odwraca parzystosc i
        // reszta pliku znika ze skanu.
        if (c !== "`" && src[j] === "\n") { j = -1; break; }
        buf += src[j]; j++;
      }
      if (j === -1 || j >= src.length) { prev = c; i++; continue; }
      found.push(buf);
      prev = c; i = j + 1; continue;
    }
    if (c.trim() || c === " " || c === "\n") prev = c;
    i++;
  }
  return found;
}

const baseline = fs.existsSync(BASELINE) ? new Set(JSON.parse(fs.readFileSync(BASELINE, "utf8")).files) : new Set();
const seenBaseline = new Set();
const JSX_TEXT = />\s*([^<>{}]{4,140}?)\s*</g;
// Nazwy wlasne (miasta, dzielnice) to DANE, nie copy - zostaja jak sa w obu jezykach.
// Klasy CSS z interpolacja tez nie sa tekstem dla uzytkownika.
// Klasy CSS z interpolacja to nie copy. Wzorzec dopuszcza tez cudzyslowy i znak zapytania,
// bo szablon typu `${x === "a" ? "klasa-1" : "klasa-2"}` trafia tu jako jeden literal.
// Identyfikator: same male litery (klucz, nazwa pola) albo STALA. Pojedyncze slowo
// z wielka litera to zwykle copy ("Dalej", "Gotowe"), wiec tu nie wpada.
const IDENT = /^[@a-z0-9_.-]+$/;
// Klasy Tailwinda i szablony klas. Sam zestaw dozwolonych znakow nie wystarcza jako warunek -
// "Bez dat" czy "Zapisz miejsce do listy" tez sa z samych liter i spacji, wiec caly slownikowy
// wykrywacz polskiego bez ogonkow byl przez to martwy. Napis uznajemy za klase dopiero, gdy
// NIESIE ZNAK, ktorego copy nie ma: myslnik, dwukropek, nawias, interpolacje, procent.
const CLASSY = /^[-a-z0-9_:/()#@[\]\s${}.%,=!'"?]+$/i;
const NOT_COPY = (s) => IDENT.test(s) || (CLASSY.test(s) && /[-:/[\]${}.%]/.test(s));
// Prefiks [module-name] to konwencja logow z CLAUDE.md - konsola nie jest interfejsem.
const isCopy = (s) => s.length >= 4 && s.length <= 140 && !s.includes("\n") && !s.includes("//")
  && !s.startsWith("/") && !s.startsWith("[") && !NOT_COPY(s) && looksPolish(s);

for (const file of walk(path.join(ROOT, "src"))) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, "utf8");

  // 3. Tekst zapasowy w t() - blad ZAWSZE, tez w plikach z baseline. Sprawdzamy KAZDY, nie
  // tylko z polskimi ogonkami: "Cofnij", "Listy" czy "Anuluj" tez sa polskie, a wygladaja
  // niewinnie. Klucz ma zyc w plikach obu jezykow, nie w wywolaniu.
  for (const m of raw.matchAll(/\bt\(\s*"[^"]+"\s*,\s*"((?:[^"\\]|\\.)+)"\s*\)/g))
    if (/[A-Za-z]/.test(m[1])) errors.push(`${rel}: tekst zapasowy w t(): "${m[1]}" - dopisz klucz do pl i en`);
  for (const m of raw.matchAll(/\bt\(\s*"[^"]+"\s*,\s*\{[^{}]*defaultValue:\s*"((?:[^"\\]|\\.)+)"/g))
    errors.push(`${rel}: defaultValue w t(): "${m[1]}" - dopisz klucz do pl i en`);

  // Recznie wybierana forma odmiany: t("x_few") dziala TYLKO po polsku - angielski ma
  // one/other, wiec taki klucz spada na fallbackLng i pokazuje polski tekst.
  for (const m of raw.matchAll(/\bt\(\s*"([a-zA-Z_.]+_(?:few|many))"/g))
    errors.push(`${rel}: t("${m[1]}") - uzyj t("${m[1].replace(/_(few|many)$/, "")}", { count }) zamiast recznej formy`);

  // 4. polski na sztywno. Linia z `i18n-ignore` jest pomijana - to furtka dla DANYCH
  // (nazwy wlasne miast, dzielnic), ktore w obu jezykach brzmia tak samo. Nie uzywaj jej
  // do copy, ktore po prostu nie zostalo jeszcze przetlumaczone - od tego jest baseline.
  const src = stripComments(maskIgnored(raw));
  const hits = new Set();
  for (const lit of literals(src)) if (isCopy(lit.trim())) hits.add(lit.trim());
  for (const m of src.matchAll(JSX_TEXT)) if (isCopy(m[1].trim())) hits.add(m[1].trim());
  if (!hits.size) continue;
  if (baseline.has(rel)) { seenBaseline.add(rel); continue; }
  errors.push(`${rel}: ${hits.size} polskich napisow na sztywno (pierwszy: "${[...hits][0]}")`);
}

for (const f of baseline) if (!seenBaseline.has(f)) warn.push(`${f}: juz czysty - usun go z scripts/i18n-baseline.json`);

if (warn.length) { console.log("i18n: do posprzatania"); for (const w of warn) console.log("  ~ " + w); }
if (errors.length) {
  console.error(`\ni18n: ${errors.length} problemow\n`);
  for (const e of errors) console.error("  x " + e);
  console.error("\nNowy widok ma miec komplet kluczy PL i EN w tym samym commicie (CLAUDE.md).");
  process.exit(1);
}
console.log(`i18n: ok (${namespaces.length} przestrzeni nazw, ${baseline.size} plikow w baseline do nadrobienia)`);
