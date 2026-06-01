/**
 * poc-popular-dishes.ts
 *
 * Proof of concept #3: dla wybranych lokali fetchuje Google Reviews i prosi
 * Claude o wyciągnięcie top dań/produktów najczęściej wspominanych przez gości.
 *
 * Cel: zweryfikować czy "popularne dania z reviews" daje lepszy value niż menu
 * (pokrycie ~95%, bo każdy lokal ma reviews).
 *
 * Pipeline:
 *   1. DB → places z google_place_id
 *   2. Google Place Details fields=reviews,editorial_summary,name
 *   3. Claude analizuje reviews → top 5 wzmiankowanych dań/produktów
 *   4. JSON output + console
 *
 * Uruchomienie:
 *   npm run poc:dishes -- --city=Kraków --limit=5 --category=cafe,restaurant
 *
 * Wymagane env: ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Koszt szacunkowy: <$0.01 per lokal (reviews to malo tekstu). Dla 5 lokali = ~$0.05.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ─── env ─────────────────────────────────────────────────────────────────────

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

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const args = process.argv.slice(2);
const CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Kraków";
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "5");
const CATEGORY_FILTER = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const CATEGORIES = CATEGORY_FILTER ? CATEGORY_FILTER.split(",").map((c) => c.trim()) : ["restaurant", "cafe"];
const MODEL = "claude-sonnet-4-6";

if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!GOOGLE_API_KEY) { console.error("❌ Brak GOOGLE_MAPS_API_KEY"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ Brak ANTHROPIC_API_KEY"); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Google Place Details: reviews + editorial_summary ──────────────────────

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  language?: string;
  relative_time_description?: string;
}

interface PlaceDetailsResult {
  name?: string;
  reviews?: GoogleReview[];
  editorial_summary?: { overview?: string; language?: string };
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,reviews,editorial_summary");
  url.searchParams.set("language", "pl");
  url.searchParams.set("reviews_no_translations", "true");
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; result?: PlaceDetailsResult; error_message?: string };
  if (data.status !== "OK") {
    console.log(`    ⚠️ Google status: ${data.status} ${data.error_message ?? ""}`);
    return null;
  }
  return data.result ?? null;
}

// ─── Claude analysis ────────────────────────────────────────────────────────

interface PopularDish {
  name: string;
  mentions: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
}

interface DishesAnalysis {
  popular_dishes: PopularDish[];
  notes?: string;
}

function buildPrompt(placeName: string, category: string, editorialSummary: string | undefined, reviews: GoogleReview[]): string {
  const reviewsText = reviews.map((r, i) =>
    `[REVIEW ${i + 1}] (${r.rating}★, ${r.relative_time_description ?? "n/a"})\n${r.text}`
  ).join("\n\n");

  const editorial = editorialSummary ? `\nKrótki opis lokalu (od Google):\n${editorialSummary}\n` : "";

  return `Analizujesz opinie klientów lokalu gastronomicznego "${placeName}" (${category}).
${editorial}
Twoje zadanie: wyciągnij listę 3-5 DAŃ/PRODUKTÓW/NAPOJÓW, które są najczęściej polecane lub wspominane.

Reguły:
- WSKAŻ konkretne pozycje z menu (np. "Pierogi ruskie", "Tatar wołowy", "Cappuccino z mlekiem owsianym")
- POGRUPUJ synonimy (np. "kawa latte" + "latte" + "kawa z mlekiem" = 1 pozycja "Latte")
- POMIŃ ogólne komentarze ("smacznie", "miło", "polecam") - musi być konkretna nazwa potrawy/produktu
- POMIŃ wzmianki negatywne i kontrowersyjne - tylko polecane
- mentions = liczba unikatowych reviews wspominających tę pozycję
- sentiment = "positive" (chwalone), "neutral" (wzmiankowane bez oceny), "mixed" (różne opinie)

Jeśli reviews nie zawierają konkretnych dań do wyciągnięcia (np. tylko ogólne komentarze) - zwróć pustą listę i wyjaśnij w notes.

Format JSON (TYLKO JSON, bez markdown, bez \`\`\`):
{
  "popular_dishes": [
    {"name": "Pierogi ruskie z masłem", "mentions": 3, "sentiment": "positive"},
    {"name": "Krupnik", "mentions": 2, "sentiment": "positive"}
  ],
  "notes": "opcjonalna notatka, max 20 słów"
}

OPINIE:
${reviewsText}`;
}

async function analyzeReviews(placeName: string, category: string, details: PlaceDetailsResult): Promise<DishesAnalysis | null> {
  if (!details.reviews?.length) {
    return { popular_dishes: [], notes: "Brak reviews w Google Place Details" };
  }
  const prompt = buildPrompt(placeName, category, details.editorial_summary?.overview, details.reviews);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`    ⚠️ Claude HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return null;
  }
  const text = (data.content?.[0]?.text ?? "").trim();
  try {
    return JSON.parse(text) as DishesAnalysis;
  } catch {
    console.log(`    ⚠️ Non-JSON: ${text.slice(0, 120)}`);
    return null;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  place_name: string;
  category: string;
  google_place_id: string;
  reviews_count: number;
  popular_dishes: PopularDish[];
  notes?: string;
  status: "ok" | "no_reviews" | "fetch_failed" | "analysis_failed";
}

async function main() {
  console.log("🍴 PoC popular dishes from reviews");
  console.log(`Model: ${MODEL}`);
  console.log(`City: ${CITY}  |  Categories: ${CATEGORIES.join(",")}  |  Places: ${LIMIT}\n`);

  const { data: places, error } = await sb
    .from("places")
    .select("id, place_name, category, google_place_id")
    .eq("is_active", true)
    .eq("city", CITY)
    .in("category", CATEGORIES)
    .not("google_place_id", "is", null)
    .limit(LIMIT);

  if (error) { console.error("DB error:", error); process.exit(1); }
  if (!places?.length) { console.log("Brak miejsc do przetworzenia."); return; }

  const results: PlaceResult[] = [];

  for (const place of places) {
    console.log(`\n━━━ ${place.place_name}  [${place.category}] ━━━`);

    const details = await fetchPlaceDetails(place.google_place_id);
    if (!details) {
      results.push({ ...placeBase(place), status: "fetch_failed", reviews_count: 0, popular_dishes: [] });
      console.log("  ✗ Fetch failed");
      continue;
    }
    const reviewsCount = details.reviews?.length ?? 0;
    console.log(`  ✓ ${reviewsCount} reviews, editorial_summary: ${details.editorial_summary?.overview ? "yes" : "no"}`);

    if (reviewsCount === 0) {
      results.push({ ...placeBase(place), status: "no_reviews", reviews_count: 0, popular_dishes: [] });
      console.log("  ⚠️ Brak reviews");
      continue;
    }

    const analysis = await analyzeReviews(place.place_name, place.category, details);
    if (!analysis) {
      results.push({ ...placeBase(place), status: "analysis_failed", reviews_count: reviewsCount, popular_dishes: [] });
      continue;
    }

    const r: PlaceResult = {
      ...placeBase(place),
      status: "ok",
      reviews_count: reviewsCount,
      popular_dishes: analysis.popular_dishes,
      notes: analysis.notes,
    };
    results.push(r);

    if (r.popular_dishes.length === 0) {
      console.log(`  ⚠️ 0 dań wyciągniętych ${r.notes ? "(" + r.notes + ")" : ""}`);
    } else {
      console.log(`  ✓ ${r.popular_dishes.length} popularnych pozycji:`);
      for (const d of r.popular_dishes) {
        console.log(`     • ${d.name}  (${d.mentions}× wzmianek, ${d.sentiment})`);
      }
      if (r.notes) console.log(`     notes: ${r.notes}`);
    }
    await sleep(400);
  }

  // save
  const outDir = resolve(process.cwd(), "scripts", "poc-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `popular-dishes-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));

  // summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const withDishes = results.filter((r) => r.popular_dishes.length > 0).length;
  const totalDishes = results.reduce((sum, r) => sum + r.popular_dishes.length, 0);
  console.log(`Lokali z popularnymi pozycjami: ${withDishes}/${results.length}  (${((withDishes / results.length) * 100).toFixed(0)}%)`);
  console.log(`Łącznie pozycji wyciągniętych: ${totalDishes}`);
  console.log(`Średnio per lokal: ${results.length ? (totalDishes / results.length).toFixed(1) : 0}`);
  console.log(`\n📄 JSON output: ${outFile}`);
}

function placeBase(p: { id: string; place_name: string; category: string; google_place_id: string }) {
  return { place_id: p.id, place_name: p.place_name, category: p.category, google_place_id: p.google_place_id };
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
