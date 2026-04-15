/**
 * populate-place-photos.ts
 *
 * Uzupełnia kolumnę photo_url w tabeli `places` dla wpisów które jej nie mają.
 * Dla każdego miejsca wywołuje Google Places Text Search API → pobiera photo_reference
 * → zapisuje jako /api/place-photo?ref=...&w=800
 *
 * Uruchomienie:
 *   npx tsx scripts/populate-place-photos.ts
 *
 * Wymagane zmienne środowiskowe (skopiuj do .env.local lub ustaw przed uruchomieniem):
 *   SUPABASE_URL=https://chxphfcpehxshvijqtlf.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← z Supabase Dashboard → Settings → API → service_role
 *   GOOGLE_MAPS_API_KEY=AIza...        ← z .env (VITE_GOOGLE_MAPS_API_KEY)
 *
 * ⚠️  Service role key omija RLS — używaj tylko lokalnie, nigdy nie commituj do repo!
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

const DRY_RUN = process.argv.includes("--dry-run"); // nie zapisuje do DB, tylko pokazuje wyniki
const BATCH_SIZE = 5;   // ile miejsc na raz (ostrożnie z limitami Google API)
const DELAY_MS = 300;   // opóźnienie między requestami do Google (ms)

// ─── Validation ──────────────────────────────────────────────────────────────

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Brak SUPABASE_SERVICE_ROLE_KEY\n" +
    "   Znajdź go w: Supabase Dashboard → Settings → API → service_role key\n" +
    "   Ustaw: SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/populate-place-photos.ts"
  );
  process.exit(1);
}

if (!GOOGLE_API_KEY) {
  console.error(
    "❌ Brak GOOGLE_MAPS_API_KEY\n" +
    "   Ustaw: GOOGLE_MAPS_API_KEY=AIza... npx tsx scripts/populate-place-photos.ts\n" +
    "   Lub dodaj VITE_GOOGLE_MAPS_API_KEY do .env"
  );
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Szuka miejsca w Google Places Text Search i zwraca photo_reference pierwszego wyniku.
 * Zwraca null gdy brak wyników lub brak zdjęć.
 */
async function fetchGooglePhotoReference(
  placeName: string,
  city: string,
  category: string
): Promise<string | null> {
  const query = `${placeName} ${city}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "pl");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`  ⚠️  Google API error ${res.status} dla "${query}"`);
    return null;
  }

  const data = await res.json() as any;

  if (data.status === "REQUEST_DENIED") {
    console.error("  ❌ Google API REQUEST_DENIED — sprawdź klucz API i uprawnienia");
    throw new Error("Google API REQUEST_DENIED");
  }

  if (data.status === "ZERO_RESULTS" || !data.results?.length) {
    console.log(`  ℹ️  Brak wyników dla "${query}"`);
    return null;
  }

  const place = data.results[0];
  const photoRef = place.photos?.[0]?.photo_reference ?? null;

  if (!photoRef) {
    console.log(`  ℹ️  Brak zdjęć w Google dla "${placeName}" (${place.name})`);
    return null;
  }

  return photoRef;
}

/** Buduje URL proxy na podstawie photo_reference */
function buildProxyUrl(photoReference: string, width = 800): string {
  return `/api/place-photo?ref=${encodeURIComponent(photoReference)}&w=${width}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Place {
  id: string;
  place_name: string;
  city: string;
  category: string;
  photo_url: string | null;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("🔍 Szukam miejsc bez photo_url...\n");

  // Pobierz wszystkie miejsca bez photo_url
  const { data: places, error } = await supabase
    .from("places")
    .select("id, place_name, city, category, photo_url")
    .or("photo_url.is.null,photo_url.eq.")
    .eq("is_active", true)
    .order("city", { ascending: true });

  if (error) {
    console.error("❌ Błąd Supabase:", error.message);
    process.exit(1);
  }

  if (!places || places.length === 0) {
    console.log("✅ Wszystkie miejsca mają już photo_url! Nic do zrobienia.");
    return;
  }

  console.log(`📋 Znaleziono ${places.length} miejsc bez zdjęcia\n`);
  if (DRY_RUN) console.log("🧪 TRYB DRY RUN — nic nie zostanie zapisane do DB\n");

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE) as Place[];

    for (const place of batch) {
      const prefix = `[${i + batch.indexOf(place) + 1}/${places.length}]`;
      process.stdout.write(`${prefix} ${place.place_name} (${place.city})... `);

      try {
        const photoRef = await fetchGooglePhotoReference(
          place.place_name,
          place.city,
          place.category
        );

        if (!photoRef) {
          console.log("⏭️  pominięto (brak w Google)");
          skipped++;
          await sleep(DELAY_MS);
          continue;
        }

        const proxyUrl = buildProxyUrl(photoRef);

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from("places")
            .update({ photo_url: proxyUrl })
            .eq("id", place.id);

          if (updateError) {
            console.log(`❌ błąd zapisu: ${updateError.message}`);
            failed++;
          } else {
            console.log(`✅ zapisano`);
            success++;
          }
        } else {
          console.log(`✅ (dry-run) byłoby zapisane: ${proxyUrl.slice(0, 60)}...`);
          success++;
        }
      } catch (err: any) {
        console.log(`❌ wyjątek: ${err.message}`);
        failed++;
        if (err.message.includes("REQUEST_DENIED")) {
          console.error("\n🛑 Zatrzymuję — problem z kluczem Google API");
          break;
        }
      }

      await sleep(DELAY_MS);
    }

    // Krótka przerwa między batchami
    if (i + BATCH_SIZE < places.length) {
      console.log(`\n  ⏳ Przerwa 1s między batchami...\n`);
      await sleep(1000);
    }
  }

  console.log("\n─────────────────────────────────");
  console.log(`✅ Zaktualizowano:  ${success}`);
  console.log(`⏭️  Pominięto:      ${skipped}`);
  console.log(`❌ Błędy:          ${failed}`);
  console.log("─────────────────────────────────");

  if (success > 0 && !DRY_RUN) {
    console.log("\n💡 Zdjęcia są teraz cachowane przez CDN przy pierwszym załadowaniu.");
    console.log("   Możesz też uruchomić skrypt z --dry-run żeby tylko podejrzeć wyniki.");
  }
}

main().catch(e => {
  console.error("Nieoczekiwany błąd:", e);
  process.exit(1);
});
