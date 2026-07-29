// Purge scache'owanych zdjęć Google ze Storage (buckety place-photos-cache + place-photos).
// Storage nie pozwala na `delete from storage.objects` w SQL - trzeba przez Storage API.
//
// Uruchom lokalnie (klucze z .env):
//   node scripts/purge-place-photos-cache.mjs
//
// Wymaga: SUPABASE_URL (lub VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY w .env.
// To jest cleanup opcjonalny - kod aplikacji już nie serwuje tych plików.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Prosty parser .env (bez dodatkowej zależności dotenv).
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[purge] Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY w .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const BUCKETS = ["place-photos-cache", "place-photos"];

async function purgeBucket(bucket) {
  let removed = 0;
  // list() jest per-folder i paginowane. Buckety cache mają płaską strukturę (pliki w root),
  // ale na wszelki wypadek obsługujemy też podfoldery rekurencyjnie.
  async function walk(prefix) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset });
      if (error) { console.error(`[purge] list ${bucket}/${prefix} error:`, error.message); return; }
      if (!data || data.length === 0) break;

      const files = data.filter((e) => e.id !== null).map((e) => (prefix ? `${prefix}/${e.name}` : e.name));
      const folders = data.filter((e) => e.id === null).map((e) => (prefix ? `${prefix}/${e.name}` : e.name));

      if (files.length) {
        const { error: rmErr } = await supabase.storage.from(bucket).remove(files);
        if (rmErr) console.error(`[purge] remove error:`, rmErr.message);
        else { removed += files.length; console.log(`[purge] ${bucket}: usunięto ${removed} plików...`); }
      }
      for (const f of folders) await walk(f);

      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  await walk("");
  console.log(`[purge] ${bucket}: GOTOWE, łącznie ${removed} plików.`);
}

for (const b of BUCKETS) {
  console.log(`[purge] Czyszczę bucket: ${b}`);
  await purgeBucket(b);
}
console.log("[purge] Wszystko wyczyszczone.");
