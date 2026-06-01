/**
 * poc-menu-from-website.ts
 *
 * Proof of concept #2: dla wybranych lokali fetchuje URL strony www z Google
 * Place Details, próbuje znaleźć menu na stronie (HTML inline lub link do menu
 * page / PDF). Bez zapisów do bazy.
 *
 * Cel: zweryfikować pokrycie menu via website (fallback dla 90% lokali, które
 * nie mają menu w Google Photos).
 *
 * Pipeline per lokal:
 *   1. Google Place Details → website URL
 *   2. Fetch HTML homepage (clean ze <script>, <style>, comments)
 *   3. Claude analizuje HTML, odpowiada: extracted | redirect | is_pdf | not_found
 *   4. Jeśli "redirect" - fetch tego URL, Claude analizuje znowu (max 1 iteracja)
 *   5. Output: structured items + status
 *
 * Uruchomienie:
 *   npm run poc:menu-web -- --city=Kraków --limit=5 --category=cafe,restaurant
 *
 * Koszt szacunkowy: ~$0.01-0.03 per lokal (HTML page do ~30k tokens).
 * Dla 5 lokali = ~$0.10.
 *
 * Wymagane env:
 *   ANTHROPIC_API_KEY
 *   GOOGLE_MAPS_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
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

const MAX_HTML_CHARS = 60_000; // ~15k tokens, zostaw budget na response
const MODEL = "claude-sonnet-4-6";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("❌ Brak SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!GOOGLE_API_KEY) { console.error("❌ Brak GOOGLE_MAPS_API_KEY"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ Brak ANTHROPIC_API_KEY"); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Google Places: get website ─────────────────────────────────────────────

async function fetchWebsite(placeId: string): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "website");
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; result?: { website?: string } };
  if (data.status !== "OK") return null;
  return data.result?.website ?? null;
}

// ─── HTML cleaning ──────────────────────────────────────────────────────────

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`    ⚠️ HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("pdf")) {
      console.log("    ℹ️ Strona zwróciła PDF zamiast HTML");
      return null;
    }
    return await res.text();
  } catch (err: any) {
    console.log(`    ⚠️ fetch error: ${String(err?.message ?? err).slice(0, 80)}`);
    return null;
  }
}

// ─── Claude analysis ────────────────────────────────────────────────────────

interface MenuItem {
  name: string;
  description?: string;
  price?: string;
}

interface MenuAnalysis {
  status: "extracted" | "redirect" | "is_pdf" | "not_found";
  redirect_url?: string;
  items?: MenuItem[];
  notes?: string;
}

const ANALYSIS_PROMPT = (originalUrl: string, html: string) => `Analizujesz HTML strony lokalu gastronomicznego (restauracja/kawiarnia/cukiernia).

Cel: znajdź menu z cenami.

Możliwe scenariusze:
A) Menu inline na tej stronie → status="extracted", wyciągnij pozycje (max 30)
B) Na stronie jest LINK do menu (np. <a href="/menu">Menu</a>, "Karta", "Cennik") → status="redirect", redirect_url=absolutny URL
C) Link do menu PDFa (.pdf) → status="is_pdf", redirect_url=URL do PDFa
D) Strona nie ma menu i nie linkuje do niego → status="not_found"

Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`):
{
  "status": "extracted" | "redirect" | "is_pdf" | "not_found",
  "redirect_url": "https://absolute-url.pl/menu" (tylko dla redirect/is_pdf),
  "items": [{"name": "Carbonara", "description": "klasyczna z guanciale", "price": "32 zł"}] (tylko dla extracted, max 30 pozycji, opisy opcjonalne),
  "notes": "krótka notatka jeśli coś warto powiedzieć"
}

Original URL strony: ${originalUrl}

HTML (oczyszczony):
${html}`;

async function analyzeHtml(originalUrl: string, html: string): Promise<MenuAnalysis | null> {
  const truncated = html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) + "\n[...HTML obcięte]" : html;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: ANALYSIS_PROMPT(originalUrl, truncated) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`    ⚠️ Claude HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return null;
  }
  const text = (data.content?.[0]?.text ?? "").trim();
  try {
    return JSON.parse(text) as MenuAnalysis;
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
  website: string | null;
  final_status: "menu_found" | "menu_via_link" | "pdf_link" | "not_found" | "no_website" | "fetch_failed";
  menu_source_url?: string;
  items_count?: number;
  items?: MenuItem[];
  notes?: string;
}

async function processPlace(place: { id: string; place_name: string; category: string; google_place_id: string }): Promise<PlaceResult> {
  const base: PlaceResult = {
    place_id: place.id,
    place_name: place.place_name,
    category: place.category,
    google_place_id: place.google_place_id,
    website: null,
    final_status: "no_website",
  };

  console.log(`\n━━━ ${place.place_name}  [${place.category}] ━━━`);

  const website = await fetchWebsite(place.google_place_id);
  base.website = website;
  if (!website) {
    console.log("  ✗ Brak website w Google Place Details");
    base.final_status = "no_website";
    return base;
  }
  console.log(`  🌐 website: ${website}`);

  const homepage = await fetchHtml(website);
  if (!homepage) {
    base.final_status = "fetch_failed";
    return base;
  }
  console.log(`  ✓ fetched ${homepage.length} chars, cleaning…`);

  const cleaned = cleanHtml(homepage);
  console.log(`  ✓ cleaned to ${cleaned.length} chars`);

  // First pass
  const firstAnalysis = await analyzeHtml(website, cleaned);
  if (!firstAnalysis) return base;
  console.log(`  → Claude verdict (1st): ${firstAnalysis.status}${firstAnalysis.notes ? ` (${firstAnalysis.notes})` : ""}`);

  if (firstAnalysis.status === "extracted") {
    base.final_status = "menu_found";
    base.menu_source_url = website;
    base.items = firstAnalysis.items;
    base.items_count = firstAnalysis.items?.length ?? 0;
    base.notes = firstAnalysis.notes;
    console.log(`  ✓ ${base.items_count} pozycji wyciągniętych ze strony głównej`);
    return base;
  }

  if (firstAnalysis.status === "is_pdf") {
    base.final_status = "pdf_link";
    base.menu_source_url = firstAnalysis.redirect_url;
    base.notes = firstAnalysis.notes;
    console.log(`  📄 PDF: ${firstAnalysis.redirect_url}`);
    return base;
  }

  if (firstAnalysis.status === "not_found") {
    base.final_status = "not_found";
    base.notes = firstAnalysis.notes;
    return base;
  }

  // status === "redirect" - follow once
  const menuUrl = firstAnalysis.redirect_url;
  if (!menuUrl) {
    base.final_status = "not_found";
    return base;
  }
  console.log(`  ↪ Claude wskazał menu page: ${menuUrl}`);

  const menuPage = await fetchHtml(menuUrl);
  if (!menuPage) return base;
  const menuCleaned = cleanHtml(menuPage);
  console.log(`  ✓ menu page fetched & cleaned to ${menuCleaned.length} chars`);

  const secondAnalysis = await analyzeHtml(menuUrl, menuCleaned);
  if (!secondAnalysis) return base;
  console.log(`  → Claude verdict (2nd): ${secondAnalysis.status}`);

  if (secondAnalysis.status === "extracted") {
    base.final_status = "menu_via_link";
    base.menu_source_url = menuUrl;
    base.items = secondAnalysis.items;
    base.items_count = secondAnalysis.items?.length ?? 0;
    base.notes = secondAnalysis.notes;
    console.log(`  ✓ ${base.items_count} pozycji wyciągniętych z menu page`);
  } else if (secondAnalysis.status === "is_pdf") {
    base.final_status = "pdf_link";
    base.menu_source_url = secondAnalysis.redirect_url;
    console.log(`  📄 PDF: ${secondAnalysis.redirect_url}`);
  } else {
    base.final_status = "not_found";
    base.notes = secondAnalysis.notes;
  }

  return base;
}

async function main() {
  console.log("🍽  PoC menu from website");
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

  console.log(`Znalezione: ${places.length} miejsc`);

  const results: PlaceResult[] = [];
  for (const p of places) {
    const r = await processPlace(p);
    results.push(r);
    await sleep(500);
  }

  // save
  const outDir = resolve(process.cwd(), "scripts", "poc-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `menu-from-website-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));

  // summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const byStatus = new Map<string, number>();
  for (const r of results) byStatus.set(r.final_status, (byStatus.get(r.final_status) ?? 0) + 1);
  console.log(`Łącznie: ${results.length} lokali`);
  for (const [s, n] of byStatus) console.log(`  ${s.padEnd(16)} ${n}`);
  const found = results.filter((r) => r.final_status === "menu_found" || r.final_status === "menu_via_link").length;
  const pdfLinks = results.filter((r) => r.final_status === "pdf_link").length;
  console.log(`\nMenu wyciągnięte (HTML): ${found}/${results.length} (${((found / results.length) * 100).toFixed(0)}%)`);
  console.log(`Z PDFami (do future):    ${pdfLinks}/${results.length} (${((pdfLinks / results.length) * 100).toFixed(0)}%)`);
  console.log(`\n📄 JSON output: ${outFile}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
