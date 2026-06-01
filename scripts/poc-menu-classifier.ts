/**
 * poc-menu-classifier.ts
 *
 * Proof of concept: dla wybranych restauracji/kawiarni z bazy fetchuje zdjęcia
 * z Google Places i pyta Claude Vision "czy to menu?". Bez zapisów do bazy.
 *
 * Cel: zweryfikować jakość klasyfikacji przed pełną implementacją (migracja +
 * edge function + batch backfill + UI).
 *
 * Uruchomienie:
 *   npm run poc:menu -- --city=Kraków --limit=5 --photos-per-place=5
 *
 * Domyślnie: Kraków, 5 lokali, 5 photos/lokal.
 *
 * Output:
 *   - Tabelka w konsoli (per place: lista photos + verdict)
 *   - Plik JSON `scripts/poc-output/menu-classification-{timestamp}.json` do
 *     wizualnej weryfikacji (URL + verdict) - możesz otworzyć URLe w przeglądarce
 *     żeby sprawdzić czy klasyfikacja jest poprawna.
 *
 * Wymagane env (.env.local lub .env):
 *   ANTHROPIC_API_KEY         klucz do Claude Vision
 *   GOOGLE_MAPS_API_KEY       klucz z włączoną legacy Places API
 *   SUPABASE_SERVICE_ROLE_KEY service role (omija RLS, lokalne odpalanie)
 *
 * Koszt szacunkowy: ~$0.003 per zdjęcie (Sonnet 4.6 vision).
 * Dla domyślnych 5x5 = 25 photos = ~$0.08.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ─── env loading (bez zewnętrznej zależności) ───────────────────────────────

function loadDotenv(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
loadDotenv(".env.local");
loadDotenv(".env");

// ─── config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const args = process.argv.slice(2);
const CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Kraków";
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "5");
const PHOTOS_PER_PLACE = Math.min(10, Math.max(1, Number(args.find((a) => a.startsWith("--photos-per-place="))?.split("=")[1] ?? "5")));
const CATEGORY_FILTER = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const CATEGORIES = CATEGORY_FILTER ? CATEGORY_FILTER.split(",").map((c) => c.trim()) : ["restaurant", "cafe"];

const PHOTO_MAX_WIDTH = 1024;
const PHOTO_MAX_HEIGHT = 1024;
const MODEL = "claude-sonnet-4-6";

// ─── validation ─────────────────────────────────────────────────────────────

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error("❌ Brak GOOGLE_MAPS_API_KEY");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("❌ Brak ANTHROPIC_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Google Places (Old API) ────────────────────────────────────────────────

interface GooglePhoto {
  photo_reference: string;
  width: number;
  height: number;
}

async function fetchPlaceDetails(placeId: string): Promise<GooglePhoto[] | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "photos");
  url.searchParams.set("language", "pl");
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; result?: { photos?: GooglePhoto[] }; error_message?: string };
  if (data.status === "REQUEST_DENIED") {
    console.error(`  ❌ Google REQUEST_DENIED: ${data.error_message ?? ""}`);
    return null;
  }
  return data.result?.photos ?? null;
}

async function downloadPhotoBase64(photoRef: string): Promise<{ base64: string; mime: string } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", String(PHOTO_MAX_WIDTH));
  url.searchParams.set("maxheight", String(PHOTO_MAX_HEIGHT));
  url.searchParams.set("photoreference", photoRef);
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const mime = res.headers.get("content-type") || "image/jpeg";
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, mime };
}

// ─── Claude Vision classification ───────────────────────────────────────────

interface Classification {
  is_menu: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
}

const CLASSIFICATION_PROMPT = `Czy to zdjęcie pokazuje MENU lub CENNIK lokalu (restauracji/kawiarni/cukierni)?

✓ TAK (is_menu=true) - cokolwiek, co informuje gości o ofercie + cenach:
- klasyczne menu drukowane (lista dań z cenami)
- tablica kredowa z dziennym menu i cenami
- foto-menu / ulotka / plakat z opisem dań i cenami
- karta wina, drinków, napojów z cenami
- witryna sklepowa lub cukiernicza z widocznymi ETYKIETAMI CENOWYMI przy produktach
- ścienna tablica z ofertą i cenami (np. "Latte 12 zł, Cappuccino 14 zł")
- screenshot menu z innego źródła (Instagram, web)
- plakat promocyjny ze wskazaniem produktu i ceny

✗ NIE (is_menu=false):
- samo zdjęcie potrawy/kawy/drinka bez tekstu z ceną
- zdjęcie wnętrza lokalu, krzeseł, stołów, dekoracji
- fasada lokalu, obsługa, baristy, goście
- zdjęcia brandowe/logo bez listy dań ani cen
- pojedynczy szyld/baner bez konkretnej oferty z cenami (np. samo "Happy Hour" bez listy produktów)
- pojedynczy tort/wypiek/danie bez widocznego tekstu z ceną

Kluczowa reguła: jeśli zdjęcie pokazuje co najmniej kilka produktów Z WIDOCZNYMI CENAMI (drukowanymi lub na etykietkach) - oznacz jako MENU/CENNIK.

Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`):
{"is_menu": true|false, "confidence": "low"|"medium"|"high", "reason": "krótkie uzasadnienie po polsku, max 15 słów"}`;

async function classifyMenu(base64: string, mime: string): Promise<Classification | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
            { type: "text", text: CLASSIFICATION_PROMPT },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.warn(`  ⚠️ Claude HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return null;
  }
  const text = (data.content?.[0]?.text ?? "").trim();
  try {
    const parsed = JSON.parse(text) as Classification;
    if (typeof parsed.is_menu !== "boolean") throw new Error("missing is_menu");
    return parsed;
  } catch {
    console.warn(`  ⚠️ Non-JSON response: ${text.slice(0, 120)}`);
    return null;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

interface ResultRow {
  place_id: string;
  place_name: string;
  category: string;
  google_place_id: string;
  photo_index: number;
  photo_reference: string;
  photo_url_proxy: string;
  is_menu: boolean;
  confidence: string;
  reason: string;
}

async function main() {
  console.log("🍽  PoC menu classifier");
  console.log(`Model: ${MODEL}`);
  console.log(`City: ${CITY}  |  Categories: ${CATEGORIES.join(",")}  |  Places: ${LIMIT}  |  Photos/place: ${PHOTOS_PER_PLACE}\n`);

  const { data: places, error } = await sb
    .from("places")
    .select("id, place_name, category, google_place_id")
    .eq("is_active", true)
    .eq("city", CITY)
    .in("category", CATEGORIES)
    .not("google_place_id", "is", null)
    .limit(LIMIT);

  if (error) { console.error("DB error:", error); process.exit(1); }
  if (!places?.length) { console.log("Brak miejsc do przetworzenia w bazie."); return; }

  console.log(`Znalezione: ${places.length} miejsc\n`);

  const results: ResultRow[] = [];

  for (const place of places) {
    console.log(`\n━━━ ${place.place_name}  [${place.category}] ━━━`);
    console.log(`  google_place_id: ${place.google_place_id}`);

    const photos = await fetchPlaceDetails(place.google_place_id);
    if (!photos?.length) {
      console.log("  ⚠️ Brak photos w Google Place Details");
      continue;
    }

    const slice = photos.slice(0, PHOTOS_PER_PLACE);
    console.log(`  Photos w Google: ${photos.length}  (klasyfikujemy: ${slice.length})`);

    let menuCount = 0;
    for (let i = 0; i < slice.length; i++) {
      const photo = slice[i];
      const dl = await downloadPhotoBase64(photo.photo_reference);
      if (!dl) {
        console.log(`  [${i + 1}] ⚠️ download failed`);
        continue;
      }

      const c = await classifyMenu(dl.base64, dl.mime);
      if (!c) {
        console.log(`  [${i + 1}] ⚠️ classify failed`);
        continue;
      }

      const icon = c.is_menu ? "✓ MENU   " : "✗ not    ";
      const conf = c.confidence.padEnd(6);
      console.log(`  [${i + 1}] ${icon} ${conf} ${c.reason}`);

      if (c.is_menu) menuCount++;

      results.push({
        place_id: place.id,
        place_name: place.place_name,
        category: place.category,
        google_place_id: place.google_place_id,
        photo_index: i,
        photo_reference: photo.photo_reference,
        photo_url_proxy: `https://trasa.travel/api/place-photo?ref=${encodeURIComponent(photo.photo_reference)}&w=1024`,
        is_menu: c.is_menu,
        confidence: c.confidence,
        reason: c.reason,
      });

      await sleep(150);
    }

    console.log(`  → ${menuCount}/${slice.length} oznaczone jako menu`);
    await sleep(400);
  }

  // export JSON
  const outDir = resolve(process.cwd(), "scripts", "poc-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `menu-classification-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));

  // summary
  const total = results.length;
  const menus = results.filter((r) => r.is_menu).length;
  const cost = (total * 0.003).toFixed(3);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Photos sklasyfikowanych: ${total}`);
  console.log(`Oznaczonych jako menu:   ${menus}  (${total ? ((menus / total) * 100).toFixed(1) : 0}%)`);

  // per category breakdown
  const byCategory = new Map<string, { total: number; menus: number }>();
  for (const r of results) {
    const acc = byCategory.get(r.category) ?? { total: 0, menus: 0 };
    acc.total++;
    if (r.is_menu) acc.menus++;
    byCategory.set(r.category, acc);
  }
  for (const [cat, stats] of byCategory) {
    const pct = stats.total ? ((stats.menus / stats.total) * 100).toFixed(1) : "0";
    console.log(`  └─ ${cat.padEnd(12)} ${stats.menus}/${stats.total}  (${pct}%)`);
  }

  console.log(`Szacowany koszt Claude:  ~$${cost}`);
  console.log(`\n📄 JSON output: ${outFile}`);
  console.log(`   Otwórz URLe w przeglądarce żeby zweryfikować klasyfikację wizualnie.`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
