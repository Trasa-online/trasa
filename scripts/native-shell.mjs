// Natywka MUSI startowac z powloki aplikacji, nie z landingu (2026-09-08).
//
// Zgloszenie Nat: "przy odpalaniu aplikacji pokazuje mi sie przez ulamek sekundy landing page".
// To nie byl blad renderowania - to byl WLASCIWY plik, tylko nie ten, co trzeba.
//
// Build celowo zamienia pliki miejscami (scripts/inject-landing-snapshot.mjs): landing
// z wklejona trescia ladu je w dist/index.html, bo Vercel serwuje "/" wlasnie z niego, a
// powloka aplikacji przenosi sie do dist/app.html. Capacitor tego nie wie - WebView zawsze
// otwiera index.html. Natywka dostawala wiec landing z GOTOWA trescia w <div id="root">
// i pokazywala go do momentu, az React zamontuje sie i podmieni zawartosc.
//
// Ten krok leci PO `cap sync` (sync nadpisuje katalog public swiezym dist) i podmienia
// index.html w projekcie natywnym na powloke. Web zostaje nietkniety - dist/ sie nie zmienia.

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const SHELL = resolve(ROOT, "dist/app.html");
const TARGETS = [
  resolve(ROOT, "ios/App/App/public/index.html"),
  resolve(ROOT, "android/app/src/main/assets/public/index.html"),
];

if (!existsSync(SHELL)) {
  console.error("[natywka] brak dist/app.html - najpierw `npm run build`");
  process.exit(1);
}

// Zabezpieczenie: gdyby inject-landing-snapshot kiedys przestal oprozniac <div id="root">,
// skopiowalibysmy landing na natywke i blad wrocilby po cichu.
const shell = readFileSync(SHELL, "utf8");
const root = shell.match(/<div id="root">([\s\S]*?)<\/div>/);
if (root && root[1].trim().length > 0) {
  console.error("[natywka] dist/app.html NIE jest pusta powloka - przerywam, zeby nie wgrac landingu");
  process.exit(1);
}

let done = 0;
for (const target of TARGETS) {
  if (!existsSync(target)) continue;   // Android moze nie byc dodany
  copyFileSync(SHELL, target);
  console.log(`[natywka] ${target.replace(ROOT + "/", "")} = powloka aplikacji (bez landingu)`);
  done += 1;
}
if (!done) console.warn("[natywka] nie znalazlem zadnego projektu natywnego - pomijam");
