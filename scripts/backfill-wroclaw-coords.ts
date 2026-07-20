/**
 * Backfill współrzędnych + google_place_id dla Wrocławia (Google Text Search, legacy).
 * READ z Google, ZAPIS tylko do pliku .sql (nie dotyka DB bezpośrednio).
 *
 * Wejście:  supabase/migrations/20260720_places_wroclaw.sql (nazwy + seed coords)
 * Wyjście:  supabase/migrations/20260720_places_wroclaw_coords_fix.sql (UPDATE-y)
 *
 * Uruchom:  npx tsx scripts/backfill-wroclaw-coords.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

// wczytaj .env bez dotenv
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* */ }

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
if (!KEY) { console.error("❌ Brak GOOGLE_MAPS_API_KEY"); process.exit(1); }

const SEED = new URL("../supabase/migrations/20260720_places_wroclaw.sql", import.meta.url);
const OUT = new URL("../supabase/migrations/20260720_places_wroclaw_coords_fix.sql", import.meta.url);

const sql = readFileSync(SEED, "utf8");
// name (grupa 1, z '' jako escaped apostrof), lat (2), lng (3)
const re = /\('Wrocław',\s*'((?:[^']|'')*)',\s*'[a-z]+',\s*'(?:[^']|'')*',\s*(-?\d+\.\d+),\s*(-?\d+\.\d+),/g;
const rows: { nameSql: string; nameQ: string; lat: number; lng: number }[] = [];
let m: RegExpExecArray | null;
while ((m = re.exec(sql))) {
  rows.push({ nameSql: m[1], nameQ: m[1].replace(/''/g, "'"), lat: +m[2], lng: +m[3] });
}
console.log(`📦 Wczytano ${rows.length} lokali z seedu\n`);

function haversine(a: number, b: number, c: number, d: number) {
  const R = 6371000, r = (x: number) => (x * Math.PI) / 180;
  const dA = r(c - a), dO = r(d - b);
  const s = Math.sin(dA / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dO / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textSearch(name: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  u.searchParams.set("query", `${name} Wrocław`);
  u.searchParams.set("language", "pl");
  u.searchParams.set("region", "pl");
  u.searchParams.set("key", KEY);
  const d = (await (await fetch(u.toString())).json()) as any;
  if (d.status === "REQUEST_DENIED") throw new Error("REQUEST_DENIED: " + d.error_message);
  return d.results?.[0] ?? null;
}

const isWroclaw = (addr: string) =>
  /wrocław/i.test(addr) || /\b5[0-4]-\d{3}\b/.test(addr); // kody 50-54 = Wrocław i okolice

(async () => {
  const updates: string[] = [];
  const review: string[] = [];
  let calls = 0, ok = 0, big = 0;

  for (const row of rows) {
    calls++;
    let r: any = null;
    try { r = await textSearch(row.nameQ); } catch (e: any) {
      console.error(`❌ ${row.nameQ}: ${e.message}`); review.push(`-- BŁĄD API: ${row.nameSql}`); continue;
    }
    await sleep(80);
    if (!r) { console.log(`⚠️  brak wyników: ${row.nameQ}`); review.push(`-- BRAK WYNIKÓW: ${row.nameSql}`); continue; }

    const lat = r.geometry.location.lat, lng = r.geometry.location.lng;
    const addr = r.formatted_address ?? "";
    const dist = haversine(row.lat, row.lng, lat, lng);

    if (!isWroclaw(addr)) {
      console.log(`🔎 REVIEW (spoza Wrocławia?): ${row.nameQ} → ${r.name} | ${addr}`);
      review.push(`-- REVIEW spoza Wrocławia: ${row.nameSql} → ${r.name} | ${addr} | ${lat},${lng} | ${r.place_id}`);
      continue;
    }

    ok++;
    if (dist > 300) big++;
    const flag = dist > 300 ? `  (przesunięcie ${dist} m)` : "";
    console.log(`✅ ${row.nameQ} → ${dist} m${flag}`);
    updates.push(
      `UPDATE public.places SET latitude = ${lat}, longitude = ${lng}, google_place_id = '${r.place_id}'\n` +
      `WHERE city = 'Wrocław' AND place_name = '${row.nameSql}';`
    );
  }

  const header =
    `-- Backfill współrzędnych + google_place_id dla Wrocławia\n` +
    `-- Wygenerowane z Google Places Text Search (${calls} zapytań).\n` +
    `-- Dopasowano ${ok}/${rows.length}. Do ręcznego sprawdzenia: ${review.length} (poniżej, zakomentowane).\n\n`;
  const reviewBlock = review.length ? `\n-- ── DO SPRAWDZENIA RĘCZNEGO ────────────────────────────────\n${review.join("\n")}\n` : "";
  writeFileSync(OUT, header + updates.join("\n\n") + "\n" + reviewBlock, "utf8");

  console.log("\n" + "─".repeat(60));
  console.log(`Zapytań: ${calls}  (~$${((calls * 32) / 1000).toFixed(2)})`);
  console.log(`UPDATE-ów: ${updates.length}  |  do sprawdzenia: ${review.length}  |  przesunięcia >300 m: ${big}`);
  console.log(`Zapisano: supabase/migrations/20260720_places_wroclaw_coords_fix.sql`);
})();
