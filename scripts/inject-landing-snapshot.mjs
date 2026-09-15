// Wstrzykniecie migawki landingu do zbudowanego HTML-a (krok po `vite build`, KAZDY build).
//
// Czysty Node, zero przegladarki - dlatego dziala tak samo u nas i w srodowisku budowania
// Vercela, gdzie Chromium nie wstaje. Migawke generuje osobno `npm run prerender:snapshot`
// (patrz scripts/prerender-landing.mjs).
//
// Co robi: bierze swiezo zbudowany dist/index.html, wkleja tresc landingu w <div id="root">
// i zapisuje jako dist/landing.html. Vercel serwuje ten plik pod "/" (patrz vercel.json),
// a cala reszta aplikacji dalej dostaje index.html.
//
// Dlaczego OSOBNY plik, a nie podmiana index.html: index.html wspoldziela cala aplikacja -
// panel B2B, panel admina, powloka natywna. Gdyby wkleic tam landing, mignalby przy kazdym
// wejsciu do panelu.
//
// React montuje sie przez `createRoot().render()`, nie `hydrateRoot()`, wiec nie ma mowy
// o bledach niezgodnosci hydracji - wstrzyknieta tresc jest po prostu zastepowana identyczna
// po starcie JS.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
// Uwaga na kolejnosc w Vercelu: pliki statyczne sa serwowane ZANIM zadzialaja przepisania
// z vercel.json. Pierwsza wersja zapisywala landing do dist/landing.html i przepisywala "/"
// na ten plik - regula nigdy sie nie odpalala, bo "/" pasowal do istniejacego index.html
// (zweryfikowane na produkcji: landing.html mial pelna tresc, a "/" oddawal pusty dokument).
// Dlatego odwracamy uklad: LANDING zostaje pod index.html, a powloka aplikacji przenosi sie
// do app.html, na ktora przepisujemy cala reszte tras.
const INDEX = resolve(ROOT, "dist/index.html");
const SHELL = resolve(ROOT, "dist/app.html");
const EN = resolve(ROOT, "dist/en.html");
const SNAP_HTML = resolve(ROOT, "prerender/landing.snapshot.html");
const SNAP_META = resolve(ROOT, "prerender/landing.snapshot.json");
const SNAP_HTML_EN = resolve(ROOT, "prerender/landing.en.snapshot.html");
const SNAP_META_EN = resolve(ROOT, "prerender/landing.en.snapshot.json");
const SOURCE = resolve(ROOT, "src/pages/SpontawayLanding.tsx");

function fallback(reason) {
  // Brak migawki nie moze wywrocic wdrozenia. app.html musi powstac ZAWSZE, bo na niego
  // wskazuje przepisanie wszystkich tras - inaczej cala aplikacja poza "/" dostaje 404.
  console.warn(`[landing] bez prerenderu (${reason}) - "/" dostanie zwykla powloke aplikacji`);
  if (existsSync(INDEX)) copyFileSync(INDEX, SHELL);
  process.exit(0);
}

if (!existsSync(INDEX)) fallback("brak dist/index.html");
if (!existsSync(SNAP_HTML)) fallback("brak prerender/landing.snapshot.html");

const markup = readFileSync(SNAP_HTML, "utf8");
const meta = existsSync(SNAP_META) ? JSON.parse(readFileSync(SNAP_META, "utf8")) : {};
// Migawka EN jest opcjonalna: gdy jej nie ma (stare prerender/), "/" dziala jak dotad,
// a /en po prostu nie powstaje. Wdrozenie nie moze sie o to wywrocic.
const hasEn = existsSync(SNAP_HTML_EN);
const markupEn = hasEn ? readFileSync(SNAP_HTML_EN, "utf8") : null;
const metaEn = hasEn && existsSync(SNAP_META_EN) ? JSON.parse(readFileSync(SNAP_META_EN, "utf8")) : {};

// Migawka jest zdjeciem z momentu jej wygenerowania. Gdy landing sie zmienil, a nikt jej nie
// odswiezyl, robot dostawalby STARA tresc - wiec krzyczymy glosno, ale nie blokujemy builda.
if (meta.sourceHash && existsSync(SOURCE)) {
  const current = createHash("sha256").update(readFileSync(SOURCE)).digest("hex").slice(0, 16);
  const stale = [
    current !== meta.sourceHash ? "PL" : null,
    hasEn && current !== metaEn.sourceHash ? "EN" : null,
    !hasEn ? "EN (brak migawki)" : null,
  ].filter(Boolean);
  if (stale.length) {
    console.warn("┌────────────────────────────────────────────────────────────────┐");
    console.warn(`│ UWAGA: migawka nieaktualna (${stale.join(", ").padEnd(33)})│`);
    console.warn("│ Robot dostanie STARA tresc. Odswiez ja przez:                   │");
    console.warn("│   npm run build && npm run prerender:snapshot                   │");
    console.warn("│ i zacommituj katalog prerender/.                                │");
    console.warn("└────────────────────────────────────────────────────────────────┘");
  }
}

const base = readFileSync(INDEX, "utf8");
const rootTag = base.match(/<div id="root">\s*<\/div>/);
if (!rootTag) fallback("nie znalazlem pustego <div id=\"root\"> w index.html");

// Powloka aplikacji (bez prerenderu) idzie pod app.html - tam kieruje przepisanie
// wszystkich tras poza "/" i "/en".
copyFileSync(INDEX, SHELL);

// Google musi wiedziec, ze to sa dwie wersje jezykowe TEJ SAMEJ strony, a nie duplikaty -
// bez hreflang wybralby jedna i drugiej nie pokazywal.
const ALTERNATES = [
  '<link rel="alternate" hreflang="pl" href="https://spontaway.com/" />',
  '<link rel="alternate" hreflang="en" href="https://spontaway.com/en" />',
  '<link rel="x-default" hreflang="x-default" href="https://spontaway.com/" />',
].join("\n    ");

function render(markupFor, metaFor, lang, canonical) {
  let html = base.replace(rootTag[0], `<div id="root">${markupFor}</div>`);
  if (metaFor.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${metaFor.title}</title>`);
  html = html.replace(/<html([^>]*)\slang="[^"]*"/, "<html$1").replace(/<html/, `<html lang="${lang}"`);
  html = html.replace("</head>", `  <link rel="canonical" href="${canonical}" />\n    ${ALTERNATES}\n  </head>`);
  return html;
}

const htmlPl = render(markup, meta, "pl", "https://spontaway.com/");
writeFileSync(INDEX, htmlPl, "utf8");
const textPl = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(`[landing] dist/index.html = landing PL - ${(htmlPl.length / 1024).toFixed(1)} kB, ${textPl.length} znakow tresci dla robota`);

if (markupEn) {
  const htmlEn = render(markupEn, metaEn, "en", "https://spontaway.com/en");
  writeFileSync(EN, htmlEn, "utf8");
  const textEn = markupEn.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`[landing] dist/en.html = landing EN - ${(htmlEn.length / 1024).toFixed(1)} kB, ${textEn.length} znakow tresci dla robota`);
} else {
  console.warn("[landing] brak migawki EN - /en dostanie powloke aplikacji (odpal prerender:snapshot)");
  copyFileSync(SHELL, EN);
}
console.log("[landing] dist/app.html = powloka aplikacji");
