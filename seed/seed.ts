// Trasa seed script — bulk-imports places + business_profiles from a CSV + photo folders.
// Reads ./data/places.csv and ./data/photos/{slug}/* per row, uploads to Supabase Storage,
// inserts into both places and business_profiles tables (the latter ownerless, ready to claim).

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { parse } from "csv-parse/sync";
import { config as dotenvConfig } from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenvConfig();

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? "places-photos";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const PHOTO_MAX_WIDTH = 1500;
const PHOTO_QUALITY = 80;

const PROCESSED_FILE = path.resolve("./_processed.txt");
const CSV_PATH = path.resolve("./data/places.csv");
const PHOTOS_ROOT = path.resolve("./data/photos");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── CSV row shape ─────────────────────────────────────────────────────────────
interface PlaceRow {
  slug: string;              // unique key + photo folder name (e.g. "wesola-cafe")
  place_name: string;        // display name
  city: string;              // e.g. "Kraków"
  category: string;          // e.g. "food", "culture", "nature"
  address?: string;
  latitude?: string;
  longitude?: string;
  description?: string;
  vibe_tags?: string;        // CSV: "kawiarnia,specialty_coffee,must-see"
  best_time?: string;        // CSV: "morning,afternoon"
  price_level?: string;      // 1-4
  rating?: string;           // e.g. 4.6
  google_place_id?: string;
  // Business profile extras (used only if folder has gallery photos):
  subcategories?: string;    // CSV: "kawiarnia,bistro"
  phone?: string;
  website?: string;
  instagram?: string;
  email?: string;
  opening_hours_json?: string; // JSON string, e.g. '{"mon":"9-18", ...}'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const log = (...args: unknown[]) => console.log(...args);
const fail = (...args: unknown[]) => console.error("❌", ...args);
const ok = (...args: unknown[]) => console.log("✓", ...args);

function loadProcessed(): Set<string> {
  if (!fs.existsSync(PROCESSED_FILE)) return new Set();
  return new Set(
    fs.readFileSync(PROCESSED_FILE, "utf-8").split("\n").map(s => s.trim()).filter(Boolean)
  );
}

function markProcessed(slug: string) {
  fs.appendFileSync(PROCESSED_FILE, slug + "\n");
}

function csvList(value?: string): string[] | null {
  if (!value || !value.trim()) return null;
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function parseNum(value?: string): number | null {
  if (!value || !value.trim()) return null;
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function resizePhotoToBuffer(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .rotate()                                          // honor EXIF orientation
    .resize({ width: PHOTO_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: PHOTO_QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();
}

async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (DRY_RUN) {
    return `https://DRY-RUN/${storagePath}`;
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

interface PhotoBundle {
  coverPhotoUrl: string | null;
  coverVideoUrl: string | null;
  galleryUrls: string[];
  logoUrl: string | null;
}

async function uploadPhotosForSlug(slug: string): Promise<PhotoBundle> {
  const dir = path.join(PHOTOS_ROOT, slug);
  const bundle: PhotoBundle = {
    coverPhotoUrl: null,
    coverVideoUrl: null,
    galleryUrls: [],
    logoUrl: null,
  };

  if (!fs.existsSync(dir)) {
    log(`  · brak folderu zdjęć: ${dir}`);
    return bundle;
  }

  const files = fs.readdirSync(dir);

  // Cover video (cover.mp4 or cover.mov)
  const videoFile = files.find(f => /^cover\.(mp4|mov|m4v)$/i.test(f));
  if (videoFile) {
    log(`  ↗ video: ${videoFile}`);
    const buf = fs.readFileSync(path.join(dir, videoFile));
    bundle.coverVideoUrl = await uploadToStorage(`${slug}/cover.mp4`, buf, "video/mp4");
  }

  // Cover photo
  const coverFile = files.find(f => /^cover\.(jpe?g|png|webp)$/i.test(f));
  if (coverFile) {
    log(`  ↗ cover: ${coverFile}`);
    const buf = await resizePhotoToBuffer(path.join(dir, coverFile));
    bundle.coverPhotoUrl = await uploadToStorage(`${slug}/cover.jpg`, buf, "image/jpeg");
  }

  // Logo (optional)
  const logoFile = files.find(f => /^logo\.(jpe?g|png|webp)$/i.test(f));
  if (logoFile) {
    log(`  ↗ logo: ${logoFile}`);
    const buf = await resizePhotoToBuffer(path.join(dir, logoFile));
    bundle.logoUrl = await uploadToStorage(`${slug}/logo.jpg`, buf, "image/jpeg");
  }

  // Gallery (gallery-1.jpg, gallery-2.jpg, ...)
  const galleryFiles = files
    .filter(f => /^gallery-\d+\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const file of galleryFiles) {
    log(`  ↗ ${file}`);
    const buf = await resizePhotoToBuffer(path.join(dir, file));
    const outName = file.replace(/\.(jpe?g|png|webp)$/i, ".jpg").toLowerCase();
    const url = await uploadToStorage(`${slug}/${outName}`, buf, "image/jpeg");
    bundle.galleryUrls.push(url);
  }

  return bundle;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processRow(row: PlaceRow): Promise<void> {
  if (!row.slug) {
    fail("brak `slug` — pomijam wiersz");
    return;
  }
  if (!row.place_name || !row.city || !row.category) {
    fail(`${row.slug}: brakuje place_name / city / category`);
    return;
  }

  log(`\n→ ${row.slug} — ${row.place_name}`);

  // 1. Upload photos
  const photos = await uploadPhotosForSlug(row.slug);

  // 2. Insert into `places` (the catalog)
  const placeData = {
    place_name: row.place_name,
    city: row.city,
    category: row.category,
    address: row.address || null,
    latitude: parseNum(row.latitude),
    longitude: parseNum(row.longitude),
    description: row.description || null,
    vibe_tags: csvList(row.vibe_tags),
    best_time: csvList(row.best_time),
    price_level: row.price_level ? parseInt(row.price_level, 10) || null : null,
    rating: parseNum(row.rating),
    google_place_id: row.google_place_id || null,
    photo_url: photos.coverPhotoUrl,
    is_active: true,
  };

  if (DRY_RUN) {
    ok(`(dry) places insert:`, placeData);
  } else {
    const { data: place, error: placeErr } = await supabase
      .from("places")
      .insert(placeData)
      .select("id")
      .single();
    if (placeErr) throw new Error(`places insert failed: ${placeErr.message}`);
    ok(`places.id = ${place.id}`);
    var placeId = place.id;
  }

  // 3. If we have gallery / video / logo / extras → also seed `business_profiles`
  //    (ownerless — null owner_user_id means "trasa-managed, available for claim")
  const hasExtras =
    photos.galleryUrls.length > 0 ||
    !!photos.coverVideoUrl ||
    !!photos.logoUrl ||
    !!row.phone ||
    !!row.website ||
    !!row.subcategories ||
    !!row.opening_hours_json;

  if (hasExtras) {
    let openingHours: any = null;
    if (row.opening_hours_json) {
      try {
        openingHours = JSON.parse(row.opening_hours_json);
      } catch {
        log(`  ⚠️  niepoprawny JSON w opening_hours_json — pomijam`);
      }
    }

    const businessData: any = {
      business_name: row.place_name,
      address: row.address || null,
      description: row.description || null,
      logo_url: photos.logoUrl,
      cover_image_url: photos.coverPhotoUrl,
      cover_video_url: photos.coverVideoUrl,
      gallery_urls: photos.galleryUrls.length > 0 ? photos.galleryUrls : null,
      subcategories: csvList(row.subcategories),
      tags: csvList(row.vibe_tags),
      phone: row.phone || null,
      website: row.website || null,
      email: row.email || null,
      opening_hours: openingHours,
      owner_user_id: null,        // ownerless = available to claim
      is_active: true,
      is_verified: true,           // Trasa-team curated
      plan: "zero",
    };

    if (!DRY_RUN) {
      // @ts-ignore — placeId set in non-dry-run branch above
      businessData.place_id = placeId;
    }

    if (DRY_RUN) {
      ok(`(dry) business_profiles insert:`, businessData);
    } else {
      const { error: bpErr } = await supabase
        .from("business_profiles")
        .insert(businessData);
      if (bpErr) {
        log(`  ⚠️  business_profiles insert failed: ${bpErr.message}`);
        // Don't throw — places insert succeeded, profile can be added later
      } else {
        ok(`business_profile created (ownerless)`);
      }
    }
  }

  markProcessed(row.slug);
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    fail(`Brak pliku ${CSV_PATH}. Skopiuj data/places.csv.example → data/places.csv`);
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as PlaceRow[];

  log(`📋 Loaded ${rows.length} rows`);
  if (DRY_RUN) log(`🟡 DRY RUN — nic nie zostanie zapisane do bazy ani Storage`);

  const processed = loadProcessed();
  if (processed.size > 0) log(`📁 Już zaimportowane: ${processed.size}`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (processed.has(row.slug)) {
      skipped++;
      continue;
    }
    try {
      await processRow(row);
      success++;
    } catch (err: any) {
      fail(`${row.slug}: ${err.message}`);
      errors++;
    }
  }

  log(`\n──────────────────────────────────────────`);
  log(`✅ Zaimportowano: ${success}`);
  log(`⏭  Pominiętych:  ${skipped}`);
  log(`❌ Błędów:       ${errors}`);
  log(`──────────────────────────────────────────`);
}

main().catch(err => {
  fail("Fatal:", err);
  process.exit(1);
});
