/**
 * backfill-place-galleries.ts
 *
 * Wypełnia kolumnę places.gallery_urls dla miejsc bez galerii (do 3 zdjęć na miejsce).
 *
 * Dla każdego miejsca:
 *   1. Wyszukuje miejsce w Google Places (Old) Text Search → bierze do 3 photo_references
 *   2. Pobiera binarki z Google Places Photo endpoint (302 → CDN)
 *   3. Wrzuca każde do bucket `place-photos-cache` pod ścieżką `gallery/{place_id}/{idx}.jpg`
 *   4. UPDATE places SET gallery_urls = ARRAY[url1, url2, url3]
 *
 * Idempotentne: pomija miejsca, które już mają wypełnioną galerię (>= 3 zdjęcia).
 *
 * Uruchomienie (najprościej):
 *   npm run backfill:galleries -- --city=Warszawa --dry-run --limit=5
 *   npm run backfill:galleries -- --city=Warszawa
 *
 * Skrypt automatycznie wczytuje .env.local i .env (bez zewnętrznej zależności).
 *
 * Flagi:
 *   --dry-run        tylko log, bez pobierania ani zapisu
 *   --city=Warszawa  filtr po mieście (default: Warszawa)
 *   --limit=10       max N miejsc (default: bez limitu)
 *   --per-place=3    ile zdjęć na miejsce (default: 3)
 *
 * Wymagane env (w .env.local lub przed wywołaniem):
 *   SUPABASE_SERVICE_ROLE_KEY  z Supabase Dashboard → Settings → API → service_role
 *   GOOGLE_MAPS_API_KEY        klucz z włączoną legacy "Places API" (Text Search + Photo)
 *
 * Uwaga API: używamy Old Places API (places.textsearch + place.photo) bo
 * tak ma skonfigurowany klucz aplikacji. Jeśli widzisz REQUEST_DENIED →
 * w Google Cloud Console → APIs & Services → Library → włącz "Places API".
 *
 * ⚠️  Service role omija RLS i ma pełen dostęp. Tylko lokalnie. Nigdy nie commituj.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Auto-load .env.local (bez zaleznosci od dotenv) ─────────────────────────
// Czyta linijka po linijce, ignoruje komentarze, ustawia process.env tylko
// gdy zmienna nie zostala juz podana wprost.
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

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Warszawa";
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || null;
const PER_PLACE = Math.min(10, Math.max(1, Number(args.find((a) => a.startsWith("--per-place="))?.split("=")[1] ?? "3")));

const BUCKET = "place-photos-cache";
const DELAY_MS = 250; // pauza między miejscami (rate limit Google)
const PHOTO_MAX_WIDTH = 1200;
const PHOTO_MAX_HEIGHT = 1200;

// ─── Validation ──────────────────────────────────────────────────────────────

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY (z Supabase Dashboard → Settings → API)");
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error("❌ Brak GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Google Places (Old API - taka sama co populate-place-photos.ts) ─────────

interface GooglePhoto {
  photo_reference: string;
  width: number;
  height: number;
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  photos?: GooglePhoto[];
}

/** Text Search w Old Places API. Zwraca top 1 wynik (place_id + 1 foto). */
async function searchPlace(placeName: string, city: string): Promise<GooglePlaceResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", `${placeName} ${city}`);
  url.searchParams.set("language", "pl");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`  ⚠️  Google search HTTP ${res.status}: ${txt.slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { status: string; results?: GooglePlaceResult[]; error_message?: string };
  if (data.status === "REQUEST_DENIED") {
    console.error(`  ❌ Google REQUEST_DENIED: ${data.error_message ?? "brak details"}`);
    throw new Error("Google API REQUEST_DENIED - sprawdz uprawnienia klucza w Cloud Console");
  }
  if (data.status === "ZERO_RESULTS" || !data.results?.length) return null;
  return data.results[0];
}

/** Place Details Old API - zwraca do ~10 photo_references dla danego place_id. */
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
    console.error(`  ❌ Google REQUEST_DENIED (details): ${data.error_message ?? ""}`);
    return null;
  }
  return data.result?.photos ?? null;
}

/** Pobiera binarkę zdjęcia z Old API photo endpoint. Endpoint robi 302 redirect
 *  do Google CDN; fetch z redirect:"follow" przejdzie do końcowej binarki. */
async function downloadPhoto(photoReference: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", String(PHOTO_MAX_WIDTH));
  url.searchParams.set("maxheight", String(PHOTO_MAX_HEIGHT));
  url.searchParams.set("photoreference", photoReference);
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) {
    console.warn(`  ⚠️  Photo HTTP ${res.status}`);
    return null;
  }
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function uploadToStorage(placeId: string, idx: number, buffer: ArrayBuffer, contentType: string): Promise<string | null> {
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `gallery/${placeId}/${idx}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: "31536000", // 1 rok
  });
  if (error) {
    console.warn(`  ⚠️  Storage upload error: ${error.message}`);
    return null;
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Place {
  id: string;
  place_name: string;
  city: string;
  gallery_urls: string[] | null;
}

async function main() {
  console.log(`🔍 Szukam miejsc w ${CITY} bez wypełnionej galerii (< ${PER_PLACE} zdjęć)...\n`);

  let query = sb
    .from("places")
    .select("id, place_name, city, gallery_urls")
    .ilike("city", CITY)
    .eq("is_active", true)
    .order("place_name", { ascending: true });
  if (LIMIT) query = query.limit(LIMIT);

  const { data: places, error } = await query;
  if (error) {
    console.error("❌ Błąd Supabase:", error.message);
    process.exit(1);
  }
  if (!places || places.length === 0) {
    console.log("Brak miejsc.");
    return;
  }

  const needsFill = (places as Place[]).filter((p) => (p.gallery_urls?.length ?? 0) < PER_PLACE);
  console.log(`📋 ${places.length} miejsc; ${needsFill.length} wymaga uzupełnienia\n`);
  if (DRY_RUN) console.log("🧪 DRY RUN — nic nie pobierane ani zapisywane\n");

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < needsFill.length; i++) {
    const p = needsFill[i];
    const prefix = `[${i + 1}/${needsFill.length}]`;
    process.stdout.write(`${prefix} ${p.place_name}... `);

    try {
      const gp = await searchPlace(p.place_name, p.city);
      if (!gp) {
        console.log("⏭️  brak w Google");
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }
      // Place Details daje pełną listę zdjęć (do ~10). Text Search zwraca często tylko 1.
      const detailedPhotos = await fetchPlaceDetails(gp.place_id);
      const allPhotos = detailedPhotos?.length ? detailedPhotos : (gp.photos ?? []);
      if (allPhotos.length === 0) {
        console.log("⏭️  brak zdjęć");
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }
      const photos = allPhotos.slice(0, PER_PLACE);

      if (DRY_RUN) {
        console.log(`✅ ${photos.length} foto (dry)`);
        ok++;
        await sleep(DELAY_MS);
        continue;
      }

      const urls: string[] = [];
      for (let idx = 0; idx < photos.length; idx++) {
        const photo = await downloadPhoto(photos[idx].photo_reference);
        if (!photo) continue;
        const url = await uploadToStorage(p.id, idx, photo.buffer, photo.contentType);
        if (url) urls.push(url);
      }

      if (urls.length === 0) {
        console.log("❌ wszystkie pobrania zawiodły");
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const { error: updErr } = await sb
        .from("places")
        .update({ gallery_urls: urls })
        .eq("id", p.id);

      if (updErr) {
        console.log(`❌ update: ${updErr.message}`);
        failed++;
      } else {
        console.log(`✅ ${urls.length} zdjęć`);
        ok++;
      }
    } catch (err: any) {
      console.log(`❌ exception: ${err.message ?? err}`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n──────── PODSUMOWANIE ────────`);
  console.log(`✅ Uzupełniono:  ${ok}`);
  console.log(`⏭️  Pominięto:    ${skipped}`);
  console.log(`❌ Nieudanych:   ${failed}`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
