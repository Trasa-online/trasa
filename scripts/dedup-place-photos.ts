/**
 * dedup-place-photos.ts
 *
 * Czyści zduplikowane zdjęcia w tabeli `places`:
 *   1. Usuwa dokładne duplikaty URLi wewnątrz `gallery_urls` (zachowuje pierwsze wystąpienie, kolejność bez zmian).
 *   2. Usuwa z `gallery_urls` wpisy równe `photo_url` (cover jest pokazywany osobno jako hero → bez podwójnego zdjęcia w wizytówce).
 *   3. (opcja --normalize) Dodatkowo traktuje jako duplikat ten sam obraz w różnych rozmiarach:
 *      porównuje po ścieżce URL bez query stringa (np. /api/place-photo?ref=X&w=400 == ...&w=1200).
 *
 * ⚠️  Operacja lokalna, tylko na bazie danych. $0 - NIE dotyka Google Places API,
 *     NIE pobiera zdjęć, NIE usuwa plików z Storage (tylko czyści referencje w kolumnie).
 *
 * Uruchomienie:
 *   npm run dedup:photos                      # DRY RUN - tylko raport, nic nie zapisuje
 *   npm run dedup:photos -- --normalize       # DRY RUN + wykrywanie tego samego obrazu w innych rozmiarach
 *   npm run dedup:photos -- --apply           # zapisuje zmiany do bazy
 *   npm run dedup:photos -- --apply --normalize
 *   npm run dedup:photos -- --city=Warszawa   # filtr po mieście (default: wszystkie)
 *   npm run dedup:photos -- --limit=5         # max N miejsc (do testów)
 *
 * Wymagane env (w .env.local lub .env):
 *   SUPABASE_SERVICE_ROLE_KEY  z Supabase Dashboard → Settings → API → service_role
 *
 * ⚠️  Service role omija RLS. Tylko lokalnie. Nigdy nie commituj klucza.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Auto-load .env.local / .env (bez zaleznosci od dotenv) ──────────────────
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

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const NORMALIZE = args.includes("--normalize");
const CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? null;
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || null;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY (z Supabase Dashboard → Settings → API)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Place {
  id: string;
  place_name: string;
  city: string;
  photo_url: string | null;
  gallery_urls: string[] | null;
}

/** Klucz dedupu: dokładny URL, a przy --normalize sama ścieżka bez query stringa. */
function dedupKey(url: string): string {
  if (!NORMALIZE) return url.trim();
  const t = url.trim();
  try {
    // Absolute URL (http/https)
    const u = new URL(t, "https://x.invalid");
    // Dla proxy zdjęć (/api/place-photo?ref=...&w=...) rozmiar `w`/`h` ignorujemy,
    // ale zachowujemy `ref`/`photo_reference` zeby nie sklejac roznych zdjec.
    const ref = u.searchParams.get("ref") ?? u.searchParams.get("photo_reference") ?? "";
    return ref ? `${u.pathname}::${ref}` : u.pathname;
  } catch {
    return t;
  }
}

/**
 * Zwraca oczyszczoną galerię + liczby usuniętych, albo null gdy nic do zmiany.
 */
function cleanGallery(place: Place): { next: string[]; removedDupes: number; removedCover: number } | null {
  const gallery = Array.isArray(place.gallery_urls) ? place.gallery_urls : [];
  if (gallery.length === 0) return null;

  const coverKey = place.photo_url ? dedupKey(place.photo_url) : null;
  const seen = new Set<string>();
  const next: string[] = [];
  let removedDupes = 0;
  let removedCover = 0;

  for (const raw of gallery) {
    if (typeof raw !== "string" || !raw.trim()) { removedDupes++; continue; }
    const key = dedupKey(raw);
    if (coverKey && key === coverKey) { removedCover++; continue; }
    if (seen.has(key)) { removedDupes++; continue; }
    seen.add(key);
    next.push(raw);
  }

  if (removedDupes === 0 && removedCover === 0) return null;
  return { next, removedDupes, removedCover };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Dedup zdjęć w tabeli places${CITY ? ` (miasto: ${CITY})` : " (wszystkie miasta)"}`);
  console.log(`   Tryb: ${APPLY ? "✍️  APPLY (zapis do bazy)" : "🧪 DRY RUN (tylko raport)"}${NORMALIZE ? " + normalize (ten sam obraz w innych rozmiarach)" : ""}\n`);

  // Paginacja - Supabase zwraca max 1000 wierszy na zapytanie, wiec przechodzimy zakresami.
  const PAGE = 1000;
  const places: Place[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = sb
      .from("places")
      .select("id, place_name, city, photo_url, gallery_urls")
      .not("gallery_urls", "is", null)
      .order("city", { ascending: true })
      .order("place_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (CITY) query = query.ilike("city", CITY);

    const { data, error } = await query;
    if (error) {
      console.error("❌ Błąd Supabase:", error.message);
      process.exit(1);
    }
    const batch = (data ?? []) as Place[];
    places.push(...batch);
    if (batch.length < PAGE) break;
    if (LIMIT && places.length >= LIMIT) break;
  }
  if (LIMIT && places.length > LIMIT) places.length = LIMIT;
  if (places.length === 0) {
    console.log("Brak miejsc z galerią.");
    return;
  }

  let affected = 0;
  let totalDupes = 0;
  let totalCover = 0;
  let written = 0;
  let failed = 0;

  for (const place of places) {
    const result = cleanGallery(place);
    if (!result) continue;
    affected++;
    totalDupes += result.removedDupes;
    totalCover += result.removedCover;

    const before = place.gallery_urls?.length ?? 0;
    const parts: string[] = [];
    if (result.removedDupes) parts.push(`${result.removedDupes} dup`);
    if (result.removedCover) parts.push(`${result.removedCover} cover`);
    console.log(`  • [${place.city}] ${place.place_name}: ${before} → ${result.next.length} (-${parts.join(", -")})`);

    if (APPLY) {
      const { error: upErr } = await sb
        .from("places")
        .update({ gallery_urls: result.next })
        .eq("id", place.id);
      if (upErr) {
        console.error(`    ❌ zapis nieudany: ${upErr.message}`);
        failed++;
      } else {
        written++;
      }
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`📊 Przeskanowano miejsc z galerią: ${places.length}`);
  console.log(`   Wymaga czyszczenia:            ${affected}`);
  console.log(`   Duplikaty do usunięcia:        ${totalDupes}`);
  console.log(`   Cover-w-galerii do usunięcia:  ${totalCover}`);
  if (APPLY) {
    console.log(`   ✍️  Zapisano:                   ${written}`);
    if (failed) console.log(`   ❌ Błędy zapisu:               ${failed}`);
  } else {
    console.log(`\n🧪 To był DRY RUN. Uruchom z --apply aby zapisać zmiany.`);
  }
}

main().catch((e) => {
  console.error("💥 Nieoczekiwany błąd:", e);
  process.exit(1);
});
