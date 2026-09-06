#!/usr/bin/env node
// Narzedzie robocze do przenoszenia polskich napisow z kodu do plikow tlumaczen.
//
//   node scripts/i18n-extract.mjs list <plik>        - wypisz napisy z kontekstem
//   node scripts/i18n-extract.mjs apply <mapa.json>  - wstaw klucze i podmien w kodzie
//
// Mapa: { "plik.tsx": { "ns": "profiles", "keys": { "Polski napis": ["klucz", "English"] } } }
// Napisy z interpolacja (${...} albo {{...}}) pomijamy - te przenosi sie recznie.
import fs from "node:fs";

const OPENS_STRING = new Set(["(", "=", ",", ":", "[", "{", "+", "?", "|", "&", ";", "!", "<", ">", " ", "\t", "\n", "\r", ""]);
const PL_DIA = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

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
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (mode === null) {
      if (c === "/" && n === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; i += 2; continue; }
      if (c === '"' || c === "`" || (c === "'" && OPENS_STRING.has(prev))) { mode = c; out += c; prev = c; i++; continue; }
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
function literals(src) {
  const found = []; let i = 0, prev = "";
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "`" || (c === "'" && OPENS_STRING.has(prev))) {
      let j = i + 1, buf = "";
      while (j < src.length) {
        if (src[j] === "\\") { buf += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === c) break;
        buf += src[j]; j++;
      }
      found.push({ q: c, text: buf }); prev = c; i = j + 1; continue;
    }
    if (c.trim() || c === " " || c === "\n") prev = c;
    i++;
  }
  return found;
}
const PL_WORDS = /(?:^|[^\p{L}])(?:jest|nie|sie|się|tego|tej|tym|ten|ta|twoj|twój|twoja|twoje|masz|dodaj|usun|usuń|zapisz|wybierz|brak|pokaz|pokaż|wiecej|więcej|jeszcze|tutaj|teraz|gdzie|kiedy|zeby|żeby|przez|bez|juz|już|tylko|wszystko|miejsce|miejsca|miejsc|wyjazd|wyjazdy|wyjazdu|trasa|trasy|lista|listy|zdjecie|zdjęcie|zdjecia|zdjęcia|uzytkownik|użytkownik|profil|wroc|wróć|dalej|gotowe|anuluj|zamknij|edytuj|szukaj|nowy|nowa|nowe|moje|jako|albo|oraz|czy|jak|co)(?:[^\p{L}]|$)/iu;
const looksPolish = (s) => PL_DIA.test(s) || (s.includes(" ") && PL_WORDS.test(s));
const isCopy = (s) => s.length >= 4 && s.length <= 140 && !s.includes("\n") && !s.includes("//")
  && !/^(?:[a-z0-9_.-]+|[-a-z0-9_:/[\]\s${}.%,=!'"?]+)$/i.test(s) && !s.startsWith("/") && looksPolish(s);

if (process.argv[2] === "list") {
  const file = process.argv[3];
  const raw = fs.readFileSync(file, "utf8");
  // linia z `i18n-ignore` = swiadomie zostawione DANE, nie copy do przetlumaczenia
  const src = stripComments(maskIgnored(raw));
  const ns = raw.match(/useTranslation\(\s*"([^"]+)"/);
  const seen = new Set();
  const out = [];
  for (const { text } of literals(src)) { const s = text.trim(); if (isCopy(s) && !seen.has(s)) { seen.add(s); out.push(s); } }
  for (const m of src.matchAll(/>\s*([^<>{}\n]{4,140}?)\s*</g)) { const s = m[1].trim(); if (isCopy(s) && !seen.has(s)) { seen.add(s); out.push(s); } }
  console.log(JSON.stringify({ file, ns: ns ? ns[1] : null, strings: out }, null, 1));
  process.exit(0);
}

if (process.argv[2] !== "apply") { console.error("uzycie: list <plik> | apply <mapa.json>"); process.exit(2); }

const map = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const setk = (o, dotted, v) => {
  const parts = dotted.split("."); let cur = o;
  for (const p of parts.slice(0, -1)) { if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {}; cur = cur[p]; }
  cur[parts.at(-1)] = v;
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let totalKeys = 0, totalRepl = 0;

for (const [file, cfg] of Object.entries(map)) {
  const ns = cfg.ns;
  const plPath = `src/locales/pl/${ns}.json`, enPath = `src/locales/en/${ns}.json`;
  const pl = JSON.parse(fs.readFileSync(plPath, "utf8"));
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  let src = fs.readFileSync(file, "utf8");

  // Najdluzsze napisy pierwsze - inaczej krotszy podmieni sie w srodku dluzszego.
  const entries = Object.entries(cfg.keys).sort((a, b) => b[0].length - a[0].length);
  for (const [polish, [key, english]] of entries) {
    setk(pl, key, polish); setk(en, key, english); totalKeys++;
    const P = esc(polish);
    const before = src;
    // 1) {`tekst`} / {"tekst"} w JSX -> {t("klucz")}
    src = src.replace(new RegExp(`\\{\\s*[\`"']${P}[\`"']\\s*\\}`, "g"), `{t("${key}")}`);
    // 2) atrybut="tekst" -> atrybut={t("klucz")}
    src = src.replace(new RegExp(`([a-zA-Z-]+)=["'\`]${P}["'\`]`, "g"), `$1={t("${key}")}`);
    // 3) goly literal (argument funkcji, wartosc w obiekcie, itd.)
    src = src.replace(new RegExp(`(?<![\\w$])["'\`]${P}["'\`]`, "g"), `t("${key}")`);
    // 4) tekst JSX pomiedzy znacznikami
    src = src.replace(new RegExp(`(>)\\s*${P}\\s*(<)`, "g"), `$1{t("${key}")}$2`);
    if (src !== before) totalRepl++;
    else console.error(`  ! bez podmiany: ${file} :: ${polish}`);
  }
  fs.writeFileSync(plPath, JSON.stringify(pl, null, 2) + "\n");
  fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n");
  fs.writeFileSync(file, src);
  console.log(`${file}: ${entries.length} kluczy -> ${ns}`);
}
console.log(`razem: ${totalKeys} kluczy, ${totalRepl} podmian`);
