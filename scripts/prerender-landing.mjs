// Prerender landingu do statycznego HTML-a (krok po `vite build`).
//
// Problem: aplikacja jest jednym SPA na HashRouterze, wiec serwer oddaje pusty dokument -
// zmierzone na produkcji: 5,3 kB, ZERO tekstu w <body>, ZERO naglowkow. Dla strony
// marketingowej to dwie straty naraz: robot nie ma czego zaindeksowac, a czlowiek przy
// pierwszym wejsciu oglada stan ladowania zamiast strony.
//
// Co robi ten skrypt: podnosi zbudowany `dist/`, otwiera "/", czeka az landing sie wyrenderuje
// i zapisuje gotowy HTML jako `dist/landing.html`. Vercel serwuje ten plik pod "/" (patrz
// vercel.json), a cala reszta aplikacji dalej dostaje `index.html`.
//
// Dlaczego OSOBNY plik, a nie podmiana index.html: `index.html` wspoldziela cala aplikacja -
// panel B2B, panel admina, powloka natywna. Gdyby wkleic tam landing, mignalby przy kazdym
// wejsciu do panelu.
//
// React montuje sie przez `createRoot().render()`, nie `hydrateRoot()`, wiec nie ma mowy
// o bledach niezgodnosci hydracji - prerenderowany DOM jest po prostu zastepowany identyczna
// trescia po starcie JS.
//
// Gdyby przegladarka byla niedostepna (brak binarki Chromium w srodowisku budowania),
// skrypt NIE wywraca builda: kopiuje `index.html` na `landing.html`, czyli wraca do
// dzisiejszego zachowania. Lepiej stracic prerender niz wdrozenie.

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIST = resolve(process.cwd(), "dist");
const INDEX = resolve(DIST, "index.html");
const OUT = resolve(DIST, "landing.html");
const PORT = 4390;

function fallback(reason) {
  console.warn(`[prerender] pomijam (${reason}) - landing.html = kopia index.html`);
  if (existsSync(INDEX)) copyFileSync(INDEX, OUT);
  process.exit(0);
}

if (!existsSync(INDEX)) fallback("brak dist/index.html");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  fallback("brak pakietu playwright");
}

// Serwer statyczny na zbudowanym dist - ten sam, ktorego uzywa `npm run preview`.
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
  detached: false,
});
const stop = () => { try { server.kill("SIGTERM"); } catch { /* juz nie zyje */ } };
process.on("exit", stop);

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return true;
    } catch { /* jeszcze nie wstal */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

try {
  if (!(await waitForServer())) { stop(); fallback("serwer podgladu nie wstal"); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Zgoda na cookies ustawiona z gory, zeby baner nie wladowal sie do statycznego HTML-a.
  // Nowy odwiedzajacy i tak go zobaczy - doda go React zaraz po starcie.
  await page.addInitScript(() => {
    try { localStorage.setItem("trasa_cookie_consent_v2", "granted"); } catch { /* prywatne okno */ }
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle", timeout: 45000 });
  // Czekamy na realna tresc landingu, nie na sam fakt zamontowania Reacta.
  await page.waitForSelector("h1", { timeout: 20000 });
  await page.waitForTimeout(600);

  let html = await page.content();
  await browser.close();
  stop();

  // Przegladarka wstrzykuje podpowiedzi `modulepreload` z ABSOLUTNYM adresem serwera
  // podgladu. Zostawione, wskazywalyby na localhost i na produkcji byly martwe - wiec
  // sprowadzamy je z powrotem do sciezek wzglednych wzgledem domeny.
  html = html.split(`http://localhost:${PORT}/`).join("/");

  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 400) fallback(`podejrzanie pusty wynik (${text.length} znakow tekstu)`);

  writeFileSync(OUT, html, "utf8");
  console.log(`[prerender] dist/landing.html gotowy - ${(html.length / 1024).toFixed(1)} kB, ${text.length} znakow tekstu`);
} catch (e) {
  stop();
  fallback(e?.message ?? String(e));
}
