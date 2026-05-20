/**
 * backfill-place-galleries.ts
 *
 * Wypełnia kolumnę places.gallery_urls dla miejsc bez galerii (do 3 zdjęć na miejsce).
 *
 * Dla każdego miejsca:
 *   1. Wyszukuje miejsce w Google Places New API v1 (Text Search) → bierze do 3 photo names
 *   2. Pobiera binarki z Google Places Photo Media endpoint
 *   3. Wrzuca każde do bucket `place-photos-cache` pod ścieżką `gallery/{place_id}/{idx}.jpg`
 *   4. UPDATE places SET gallery_urls = ARRAY[url1, url2, url3]
 *
 * Idempotentne: pomija miejsca, które już mają wypełnioną galerię (>= 3 zdjęcia).
 *
 * Uruchomienie:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... GOOGLE_MAPS_API_KEY=AIza... \
 *     npx tsx scripts/backfill-place-galleries.ts
 *
 * Flagi:
 *   --dry-run        tylko log, bez pobierania ani zapisu
 *   --city=Warszawa  filtr po mieście (default: Warszawa)
 *   --limit=10       max N miejsc (default: bez limitu)
 *   --per-place=3    ile zdjęć na miejsce (default: 3)
 *
 * Wymagane env:
 *   SUPABASE_SERVICE_ROLE_KEY  z Supabase Dashboard → Settings → API → service_role
 *   GOOGLE_MAPS_API_KEY        klucz Google Maps Platform z włączonymi Places API
 *
 * ⚠️  Service role omija RLS i ma pełen dostęp. Tylko lokalnie. Nigdy nie commituj.
 */

import { createClient } from "@supabase/supabase-js";

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

// ─── Google Places ───────────────────────────────────────────────────────────

interface GooglePhoto {
  name: string; // "places/ChIJ.../photos/AeS..."
  widthPx: number;
  heightPx: number;
}

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  photos?: GooglePhoto[];
}

/** Text Search w New Places API v1. Zwraca top 1 wynik z polami id + photos. */
async function searchPlace(placeName: string, city: string): Promise<GooglePlaceResult | null> {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
    },
    body: JSON.stringify({
      textQuery: `${placeName} ${city}`,
      languageCode: "pl",
      pageSize: 1,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`  ⚠️  Google search HTTP ${res.status}: ${txt.slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { places?: GooglePlaceResult[] };
  return data.places?.[0] ?? null;
}

/** Pobiera binarkę zdjęcia z Google Places Photo Media endpoint. */
async function downloadPhoto(photoName: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&maxHeightPx=${PHOTO_MAX_HEIGHT}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.warn(`  ⚠️  Photo download HTTP ${res.status} dla ${photoName.slice(0, 50)}`);
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
      if (!gp?.photos?.length) {
        console.log("⏭️  brak w Google");
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }
      const photos = gp.photos.slice(0, PER_PLACE);

      if (DRY_RUN) {
        console.log(`✅ ${photos.length} foto (dry)`);
        ok++;
        await sleep(DELAY_MS);
        continue;
      }

      const urls: string[] = [];
      for (let idx = 0; idx < photos.length; idx++) {
        const photo = await downloadPhoto(photos[idx].name);
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
