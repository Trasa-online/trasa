/**
 * backfill-place-coords.ts
 * ----------------------------------------------------------------------------
 * Uzupelnia latitude/longitude w tabeli `places` dla wpisow bez wspolrzednych,
 * geokodujac przez OpenStreetMap Nominatim (ZERO Google, zgodnie z pivotem).
 * Dzieki temu chip "X km od Ciebie" na karcie zaczyna dzialac.
 *
 * Uzycie:
 *   npx tsx scripts/backfill-place-coords.ts
 *   Opcje (env):
 *     CITY="Gdańsk"   -> tylko to miasto (domyslnie: WSZYSTKIE miasta z null coords)
 *     DRY=1           -> tylko podglad (pokazuje co Nominatim znalazl, NIC nie zapisuje)
 *     LIMIT=50        -> max ile rekordow przetworzyc w tym przebiegu
 *
 * Nominatim TOS: max 1 req/s + wlasny User-Agent (ustawione ponizej). Best-effort:
 * nietrafione/obskurne nazwy zostaja z null (bez psucia danych). W DRY sprawdz display_name.
 *
 * Wymaga SUPABASE_SERVICE_ROLE_KEY (czytane z .env automatycznie).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CITY = process.env.CITY ?? "";
const DRY = process.env.DRY === "1";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 500;
const UA = "TrasaTravel/1.0 (kontakt: nat.maz98@gmail.com)"; // Nominatim wymaga identyfikacji

if (!SERVICE_KEY) { console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY (w .env)."); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function query(q: string): Promise<{ lat: number; lon: number; display: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pl`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pl" } });
  if (!res.ok) { console.log(`   (Nominatim HTTP ${res.status})`); return null; }
  const arr: any[] = await res.json();
  if (!arr.length) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), display: arr[0].display_name };
}

// Uproszczenie nazwy dla fallbacku: utnij po " - "/"(", zdejmij generyczne prefiksy
// ("Restauracja/Kawiarnia/Pub/Bazylika..." zostaje - to pomaga), zostaw rdzen.
function simplify(name: string): string {
  return name.split(/\s+[-–]\s+/)[0].split("(")[0].replace(/\bMIR\b/, "").trim();
}

async function geocode(name: string, city: string): Promise<{ lat: number; lon: number; display: string } | null> {
  // 1. pelna nazwa + miasto
  let g = await query(`${name}, ${city}, Polska`);
  if (g) return g;
  // 2. fallback: uproszczona nazwa + miasto (dla dlugich nazw z myslnikiem/nawiasem)
  const simple = simplify(name);
  if (simple && simple !== name) {
    await sleep(1100);
    g = await query(`${simple}, ${city}, Polska`);
  }
  return g;
}

async function main() {
  let q = supabase.from("places").select("id, place_name, city").is("latitude", null).eq("is_active", true).limit(LIMIT);
  if (CITY) q = supabase.from("places").select("id, place_name, city").is("latitude", null).eq("is_active", true).eq("city", CITY).limit(LIMIT);
  const { data: rows, error } = await q;
  if (error) { console.error("❌", error.message); process.exit(1); }
  if (!rows?.length) { console.log("✅ Brak miejsc bez wspolrzednych. Nic do zrobienia."); return; }

  console.log(`\n🌍 ${rows.length} miejsc bez coords${CITY ? ` (${CITY})` : ""} | ${DRY ? "DRY-RUN" : "ZAPIS"} | ~${rows.length}s (1 req/s)\n`);
  let found = 0; const missed: string[] = [];

  for (const r of rows) {
    try {
      const g = await geocode(r.place_name, r.city);
      await sleep(1100); // TOS: max 1 req/s
      if (!g) { missed.push(`${r.place_name} (${r.city})`); console.log(`  ❓ brak: ${r.place_name} (${r.city})`); continue; }
      console.log(`  ✅ ${r.place_name}  ->  ${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}  [${g.display.slice(0, 60)}...]`);
      found++;
      if (!DRY) {
        const upd = await supabase.from("places").update({ latitude: g.lat, longitude: g.lon }).eq("id", r.id);
        if (upd.error) console.log(`     ❌ zapis: ${upd.error.message}`);
      }
    } catch (e: any) {
      missed.push(`${r.place_name} (blad: ${e?.message})`);
    }
  }

  console.log(`\n─────────────\n✅ ${DRY ? "znaleziono" : "zapisano"}: ${found} / ${rows.length}`);
  if (missed.length) console.log(`❓ bez trafienia (${missed.length}): zostaja z null (chip dystansu ich pominie)\n   ${missed.join("\n   ")}`);
  if (DRY) console.log(`\nℹ️  To byl DRY-RUN - sprawdz display_name powyzej. Bez DRY=1 zapisze do bazy.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
