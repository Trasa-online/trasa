// Generator MIGAWKI landingu (uruchamiany RECZNIE, lokalnie: `npm run prerender:snapshot`).
//
// Kontekst: aplikacja jest jednym SPA na HashRouterze, wiec serwer oddaje pusty dokument -
// zmierzone na produkcji: 5,3 kB, ZERO tekstu w <body>, ZERO naglowkow. Dla strony
// marketingowej to dwie straty naraz: robot nie ma czego zaindeksowac, a czlowiek przy
// pierwszym wejsciu oglada stan ladowania zamiast strony.
//
// Dlaczego RECZNIE, a nie w kazdym buildzie: pierwsza wersja renderowala strone Playwrightem
// jako krok po `vite build`. Lokalnie dzialalo, ale w srodowisku budowania Vercela Chromium
// nie wstaje (brak bibliotek systemowych) i skrypt kazdorazowo wpadal w fallback - produkcja
// dostawala pusty dokument mimo poprawnego builda. Rozdzielamy wiec role:
//
//   1. TEN skrypt (potrzebuje przegladarki, odpalasz go u siebie) zapisuje sama TRESC
//      landingu do prerender/landing.snapshot.html - bez odwolan do plikow z hashem.
//   2. scripts/inject-landing-snapshot.mjs (czysty Node, leci w kazdym buildzie) wkleja te
//      tresc do swiezo zbudowanego index.html i zapisuje jako dist/landing.html.
//
// Dzieki temu adresy zasobow zawsze pochodza z aktualnego builda, a migawka zawiera wylacznie
// statyczny HTML. Migawka starzeje sie tylko wtedy, gdy zmienisz TRESC landingu - dlatego
// zapisujemy tez odcisk zrodla, a krok wstrzykiwania ostrzega, gdy sie rozjada.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");
const SNAP_DIR = resolve(ROOT, "prerender");
// Jedna migawka na jezyk: "/" dostaje polska, "/en" angielska. Bez tego robot indeksowal
// polska tresc pod oboma adresami, bo jezyk rozpoznaje sie dopiero po starcie JS.
const LANGS = ["pl", "en"];
const snapHtml = (lang) => resolve(SNAP_DIR, lang === "pl" ? "landing.snapshot.html" : `landing.${lang}.snapshot.html`);
const snapMeta = (lang) => resolve(SNAP_DIR, lang === "pl" ? "landing.snapshot.json" : `landing.${lang}.snapshot.json`);
const SOURCE = resolve(ROOT, "src/pages/SpontawayLanding.tsx");
const PORT = 4390;

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("[migawka] brak dist/ - najpierw `npm run build`");
  process.exit(1);
}

const { chromium } = await import("playwright");

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { server.kill("SIGTERM"); } catch { /* juz nie zyje */ } };
process.on("exit", stop);

const deadline = Date.now() + 20000;
let up = false;
while (Date.now() < deadline && !up) {
  try { up = (await fetch(`http://localhost:${PORT}/`)).ok; } catch { /* jeszcze nie wstal */ }
  if (!up) await new Promise((r) => setTimeout(r, 400));
}
if (!up) { stop(); console.error("[migawka] serwer podgladu nie wstal"); process.exit(1); }

const browser = await chromium.launch();
mkdirSync(SNAP_DIR, { recursive: true });
const sourceHash = createHash("sha256").update(readFileSync(SOURCE)).digest("hex").slice(0, 16);

for (const lang of LANGS) {
  // Locale przegladarki ustawiamy pod jezyk migawki: to ostatni krok wykrywania w landingu,
  // wiec bez tego oba przebiegi bralyby domyslne en-US Playwrighta i zapisywalyby to samo.
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    locale: lang === "pl" ? "pl-PL" : "en-US",
  });
  // Zgoda na cookies z gory, zeby baner nie wladowal sie do statycznego HTML-a. Nowy
  // odwiedzajacy i tak go zobaczy - doda go React zaraz po starcie.
  await page.addInitScript(() => {
    try { localStorage.setItem("trasa_cookie_consent_v2", "granted"); } catch { /* prywatne okno */ }
  });
  // Jezyk wymuszamy parametrem, a nie sciezka: podglad serwuje tylko "/", a ?lang= i tak
  // wygrywa w detectLang, wiec dostajemy dokladnie te tresc, ktora zobaczy user na /en.
  await page.goto(`http://localhost:${PORT}/?lang=${lang}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("h1", { timeout: 20000 });
  await page.waitForTimeout(600);

  const { markup, title } = await page.evaluate(() => ({
    markup: document.getElementById("root")?.innerHTML ?? "",
    title: document.title,
  }));
  await page.close();

  const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 400) {
    await browser.close(); stop();
    console.error(`[migawka:${lang}] podejrzanie pusty wynik (${text.length} znakow tekstu) - przerywam`);
    process.exit(1);
  }

  writeFileSync(snapHtml(lang), markup, "utf8");
  writeFileSync(snapMeta(lang), JSON.stringify({
    lang,
    title,
    // Odcisk zrodla landingu: krok wstrzykiwania ostrzega, gdy migawka jest starsza niz kod.
    sourceHash,
    generatedAt: new Date().toISOString(),
    textLength: text.length,
  }, null, 2) + "\n", "utf8");
  console.log(`[migawka:${lang}] ${(markup.length / 1024).toFixed(1)} kB znacznikow, ${text.length} znakow tekstu`);
}

await browser.close();
stop();

console.log("[migawka] pamietaj o zacommitowaniu katalogu prerender/");
