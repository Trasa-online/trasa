/**
 * backfill-photo-cache.ts
 *
 * Wypełnia cache zdjęć w Supabase Storage dla istniejących miejsc i pinów.
 * Wywołuje edge function `cache-place-photo` która pobiera zdjęcie z Google raz
 * (w wersjach 400px + 800px), wrzuca do bucketu `place-photos-cache` i aktualizuje
 * places.photo_url / pins.photo_url stałym URL-em Storage.
 *
 * Uruchomienie:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/backfill-photo-cache.ts
 *
 * Flagi:
 *   --dry-run         tylko log, bez wywołań edge function
 *   --city=Warszawa   filtr po mieście (default: Warszawa)
 *   --table=places    'places' | 'pins' | 'both' (default: both)
 *   --limit=10        max N rekordów (default: bez limitu)
 *
 * Wymagane env:
 *   SUPABASE_URL=https://chxphfcpehxshvijqtlf.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← service_role z Supabase Dashboard
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Warszawa";
const TABLE_ARG = args.find((a) => a.startsWith("--table="))?.split("=")[1] ?? "both";
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || null;

const CONCURRENCY = 3; // jednoczesne wywołania edge function
const DELAY_MS = 200; // pauza między batch'ami (żeby nie zalać Google rate limit)

// ─── Validation ──────────────────────────────────────────────────────────────

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Brak SUPABASE_SERVICE_ROLE_KEY\n" +
      "Znajdź w: Supabase Dashboard -> Settings -> API -> service_role key\n" +
      "Uruchom: SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/backfill-photo-cache.ts"
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_MARKER = "/storage/v1/object/public/place-photos-cache/";

function isCached(url: string | null | undefined): boolean {
  return !!url && url.includes(STORAGE_MARKER);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cacheOne(target: {
  table: "places" | "pins";
  id: string;
  place_name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (DRY_RUN) return { ok: true, reason: "dry-run" };
  try {
    const { data, error } = await sb.functions.invoke("cache-place-photo", {
      body: {
        place_name: target.place_name,
        city: target.city ?? undefined,
        latitude: target.latitude ?? undefined,
        longitude: target.longitude ?? undefined,
        place_id: target.place_id ?? undefined,
        target_table: target.table,
        target_id: target.id,
      },
    });
    if (error) return { ok: false, reason: error.message };
    if ((data as any)?.error) return { ok: false, reason: (data as any).error };
    if (!(data as any)?.photo_url) return { ok: false, reason: (data as any)?.reason ?? "no photo" };
    return { ok: true, reason: (data as any).reused_existing ? "reused" : "fetched" };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

// ─── Process places ──────────────────────────────────────────────────────────

async function processPlaces() {
  console.log(`\n[places] Szukam miejsc w mieście "${CITY}" bez cache zdjęcia...`);

  let query = sb
    .from("places")
    .select("id, place_name, city, latitude, longitude")
    .ilike("city", CITY)
    .order("place_name");
  if (LIMIT) query = query.limit(LIMIT);

  const { data: places, error } = await query;
  if (error) {
    console.error("[places] Błąd query:", error.message);
    return;
  }
  if (!places || places.length === 0) {
    console.log("[places] Brak miejsc do scache'owania.");
    return;
  }

  // Filtruj te które mają już cache w photo_url
  const { data: existingPhotos } = await sb
    .from("places")
    .select("id, photo_url")
    .in("id", places.map((p) => p.id));
  const cachedIds = new Set(
    (existingPhotos ?? []).filter((p: any) => isCached(p.photo_url)).map((p: any) => p.id)
  );

  const todo = places.filter((p) => !cachedIds.has(p.id));
  console.log(`[places] Łącznie: ${places.length}, do zrobienia: ${todo.length}, już scache'owane: ${cachedIds.size}`);

  let done = 0;
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((p) =>
        cacheOne({
          table: "places",
          id: p.id,
          place_name: p.place_name,
          city: p.city,
          latitude: p.latitude,
          longitude: p.longitude,
          place_id: null,
        }).then((r) => ({ p, r }))
      )
    );
    for (const { p, r } of results) {
      done++;
      if (r.ok) {
        ok++;
        console.log(`  [${done}/${todo.length}] OK   ${p.place_name} (${r.reason})`);
      } else {
        fail++;
        console.warn(`  [${done}/${todo.length}] FAIL ${p.place_name} - ${r.reason}`);
      }
    }
    if (i + CONCURRENCY < todo.length) await sleep(DELAY_MS);
  }

  console.log(`\n[places] Gotowe: ${ok} OK, ${fail} fail z ${todo.length}`);
}

// ─── Process pins ────────────────────────────────────────────────────────────

async function processPins() {
  console.log(`\n[pins] Szukam pin'ów (route'ów) w mieście "${CITY}" bez cache zdjęcia...`);

  // pins -> routes -> city
  let query = sb
    .from("pins")
    .select("id, place_name, latitude, longitude, place_id, photo_url, routes!inner(city)")
    .is("photo_url", null)
    .ilike("routes.city", CITY);
  if (LIMIT) query = query.limit(LIMIT);

  const { data: pins, error } = await query;
  if (error) {
    console.error("[pins] Błąd query:", error.message);
    return;
  }
  if (!pins || pins.length === 0) {
    console.log("[pins] Brak pinów do scache'owania.");
    return;
  }

  console.log(`[pins] Do zrobienia: ${pins.length}`);

  let done = 0;
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < pins.length; i += CONCURRENCY) {
    const batch = pins.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((p: any) =>
        cacheOne({
          table: "pins",
          id: p.id,
          place_name: p.place_name,
          city: p.routes?.city ?? CITY,
          latitude: p.latitude,
          longitude: p.longitude,
          place_id: p.place_id ?? null,
        }).then((r) => ({ p, r }))
      )
    );
    for (const { p, r } of results) {
      done++;
      if (r.ok) {
        ok++;
        console.log(`  [${done}/${pins.length}] OK   ${p.place_name} (${r.reason})`);
      } else {
        fail++;
        console.warn(`  [${done}/${pins.length}] FAIL ${p.place_name} - ${r.reason}`);
      }
    }
    if (i + CONCURRENCY < pins.length) await sleep(DELAY_MS);
  }

  console.log(`\n[pins] Gotowe: ${ok} OK, ${fail} fail z ${pins.length}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(`Backfill photo cache${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`Miasto: ${CITY}`);
  console.log(`Tabela: ${TABLE_ARG}`);
  console.log(`Limit:  ${LIMIT ?? "brak"}`);
  console.log("=".repeat(60));

  if (TABLE_ARG === "places" || TABLE_ARG === "both") {
    await processPlaces();
  }
  if (TABLE_ARG === "pins" || TABLE_ARG === "both") {
    await processPins();
  }

  console.log("\nGotowe.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
