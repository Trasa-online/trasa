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

// Aliasy: znormalizowana (folded) nazwa PLIKU -> dokladna nazwa miejsca w bazie.
// Dla przypadkow gdzie plik nazwany zupelnie inaczej niz rekord (nie zlapie substring).
const ALIASES: Record<string, string> = {
  "punkt widokowy na gorze gradowej": "Góra Gradowa",
  "gora gradowa": "Góra Gradowa",
  "brama zielona": "Zielona Brama",
};

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};

async function main() {
  const files = readdirSync(COVERS_DIR).filter((f) => CONTENT_TYPE[extname(f).toLowerCase()]);
  if (!files.length) {
    console.error(`❌ Brak plikow JPG/PNG/WEBP w ${COVERS_DIR}.`);
    process.exit(1);
  }

  // Szukamy po WSZYSTKICH miastach (plik moze byc np. z Gdyni - Klif Orlowski). CITY sluzy
  // tylko jako tie-breaker gdy nazwa wystepuje w kilku miastach (np. Bazylika Mariacka).
  const { data: places, error } = await supabase
    .from("places")
    .select("id, place_name, city, photo_url")
    .eq("is_active", true);
  if (error) { console.error("❌ Blad pobierania miejsc:", error.message); process.exit(1); }
  const all = places ?? [];

  // Dopasowanie pliku -> miejsce: 1) dokladne (norm/fold, z preferencja CITY), 2) alias,
  // 3) fragment (nazwa pliku ⊂ nazwa miejsca lub odwrotnie, unikalne, min 4 znaki).
  function findPlace(key: string): any[] {
    const nk = norm(key), fk = fold(key);
    let cands = all.filter((p) => norm(p.place_name) === nk || fold(p.place_name) === fk);
    if (!cands.length && ALIASES[fk]) cands = all.filter((p) => p.place_name === ALIASES[fk]);
    if (!cands.length && fk.length >= 4) {
      cands = all.filter((p) => { const pf = fold(p.place_name); return pf.length >= 4 && (pf.includes(fk) || fk.includes(pf)); });
    }
    if (cands.length > 1 && CITY) {
      const inCity = cands.filter((c) => c.city === CITY);
      if (inCity.length) cands = inCity;
    }
    return cands;
  }

  console.log(`\n📁 ${files.length} plikow w ${COVERS_DIR} | tie-break miasto: ${CITY} | ${DRY ? "DRY-RUN" : "WGRYWANIE"}\n`);
  let ok = 0; const unmatched: string[] = []; const ambiguous: string[] = [];

  for (const file of files) {
    const key = basename(file, extname(file));
    const hits = findPlace(key);
    if (hits.length === 0) { unmatched.push(file); console.log(`  ❓ BRAK dopasowania: "${file}"`); continue; }
    if (hits.length > 1) { ambiguous.push(file); console.log(`  ⚠️  NIEJEDNOZNACZNE ("${file}" -> ${hits.length}): ${hits.map((h) => `${h.place_name} [${h.city}]`).join(", ")}`); continue; }
    const place = hits[0];
    if (place.photo_url && !OVERWRITE) { console.log(`  ⏭️  MA JUZ zdjecie (pomijam, OVERWRITE=1 by nadpisac): ${place.place_name}`); continue; }

    if (DRY) { console.log(`  ✅ ${file}  ->  ${place.place_name} [${place.city}]`); ok++; continue; }

    const ext = extname(file).toLowerCase();
    const path = `manual/${fold(place.city).replace(/\s+/g, "-")}/${place.id}${ext}`;
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
