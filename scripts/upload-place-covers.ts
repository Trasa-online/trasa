/**
 * upload-place-covers.ts
 * ----------------------------------------------------------------------------
 * Wgrywa RECZNIE pobrane okladki (JPG/PNG) do Supabase Storage i ustawia
 * places.photo_url. Dopasowanie plik -> miejsce po NAZWIE (znormalizowanej).
 *
 * Uzycie:
 *   1. Wrzuc zdjecia do folderu (domyslnie scripts/gdansk-covers/), nazwa pliku
 *      = nazwa miejsca, np. "Bazylika Mariacka.jpg", "Oni Ramen.png".
 *   2. Odpal:
 *        npx tsx scripts/upload-place-covers.ts
 *      Opcje (env):
 *        COVERS_DIR=/sciezka/do/folderu   (domyslnie scripts/gdansk-covers)
 *        CITY="Gdańsk"                     (domyslnie Gdańsk; dopasowuje w tym miescie)
 *        DRY=1                              (tylko podglad dopasowan, bez wgrywania)
 *        OVERWRITE=1                        (nadpisz photo_url nawet gdy juz ustawione)
 *
 * Wymaga SUPABASE_SERVICE_ROLE_KEY (czytane z .env automatycznie).
 * Bucket: place-photos-cache (publiczny). Sciezka: manual/<citySlug>/<slug>.<ext>.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

// ── .env loader (bez dodatkowej zaleznosci) ─────────────────────────────────
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
const COVERS_DIR = process.env.COVERS_DIR ?? "scripts/gdansk-covers";
const CITY = process.env.CITY ?? "Gdańsk";
const DRY = process.env.DRY === "1";
const OVERWRITE = process.env.OVERWRITE === "1";
const BUCKET = "place-photos-cache";

if (!SERVICE_KEY) {
  console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY (w .env). Przerywam.");
  process.exit(1);
}
if (!existsSync(COVERS_DIR)) {
  console.error(`❌ Folder ${COVERS_DIR} nie istnieje. Utworz go i wrzuc zdjecia (nazwa = nazwa miejsca).`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Normalizacja nazwy do dopasowania (1:1 z importem miejsc).
const norm = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, " and ").replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
// Wersja bez polskich znakow - fallback gdy plik nazwany ascii (np. "Bazylika sw Mikolaja").
const fold = (s: string) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};
const citySlug = fold(CITY).replace(/\s+/g, "-");

async function main() {
  const files = readdirSync(COVERS_DIR).filter((f) => CONTENT_TYPE[extname(f).toLowerCase()]);
  if (!files.length) {
    console.error(`❌ Brak plikow JPG/PNG/WEBP w ${COVERS_DIR}.`);
    process.exit(1);
  }

  const { data: places, error } = await supabase
    .from("places")
    .select("id, place_name, photo_url")
    .eq("city", CITY);
  if (error) { console.error("❌ Blad pobierania miejsc:", error.message); process.exit(1); }

  // Mapy dopasowan: dokladna + folded (ascii). Wykryj kolizje nazw.
  const byNorm = new Map<string, any[]>();
  const byFold = new Map<string, any[]>();
  for (const p of places ?? []) {
    (byNorm.get(norm(p.place_name)) ?? byNorm.set(norm(p.place_name), []).get(norm(p.place_name))!).push(p);
    (byFold.get(fold(p.place_name)) ?? byFold.set(fold(p.place_name), []).get(fold(p.place_name))!).push(p);
  }

  console.log(`\n📁 ${files.length} plikow w ${COVERS_DIR} | miasto: ${CITY} | ${DRY ? "DRY-RUN" : "WGRYWANIE"}\n`);
  let ok = 0; const unmatched: string[] = []; const ambiguous: string[] = [];

  for (const file of files) {
    const key = basename(file, extname(file));
    let hits = byNorm.get(norm(key)) ?? byFold.get(fold(key)) ?? [];
    if (hits.length === 0) { unmatched.push(file); console.log(`  ❓ BRAK dopasowania: "${file}"`); continue; }
    if (hits.length > 1) { ambiguous.push(file); console.log(`  ⚠️  NIEJEDNOZNACZNE ("${file}" -> ${hits.length} miejsc): ${hits.map((h) => h.place_name).join(", ")}`); continue; }
    const place = hits[0];
    if (place.photo_url && !OVERWRITE) { console.log(`  ⏭️  MA JUZ zdjecie (pomijam, OVERWRITE=1 by nadpisac): ${place.place_name}`); continue; }

    if (DRY) { console.log(`  ✅ ${file}  ->  ${place.place_name}`); ok++; continue; }

    const ext = extname(file).toLowerCase();
    const path = `manual/${citySlug}/${place.id}${ext}`;
    const body = readFileSync(join(COVERS_DIR, file));
    const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: CONTENT_TYPE[ext], upsert: true });
    if (up.error) { console.log(`  ❌ upload ${file}: ${up.error.message}`); continue; }
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const upd = await supabase.from("places").update({ photo_url: publicUrl }).eq("id", place.id);
    if (upd.error) { console.log(`  ❌ update ${place.place_name}: ${upd.error.message}`); continue; }
    console.log(`  ✅ ${place.place_name}  <-  ${file}`);
    ok++;
  }

  console.log(`\n─────────────\n✅ ${DRY ? "dopasowano" : "wgrano"}: ${ok}`);
  if (unmatched.length) console.log(`❓ bez dopasowania (${unmatched.length}): ${unmatched.join(", ")}\n   (zmien nazwe pliku na dokladna nazwe miejsca z bazy)`);
  if (ambiguous.length) console.log(`⚠️  niejednoznaczne (${ambiguous.length}): ${ambiguous.join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
