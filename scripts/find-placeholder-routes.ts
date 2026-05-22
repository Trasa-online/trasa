import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const PLACEHOLDER_NAMES = [
  "Kolacja w okolicy Placu Zamkowego",
  "Wieczorny spacer po Parku Saskim",
  "Lunch w okolicy Dworca Centralnego",
  "Kawiarnia w Pałacu Kultury i Nauki",
  "Kolacja w śródmieściu",
];

async function main() {
  const { data: pins, error } = await sb
    .from("pins")
    .select("id, route_id, place_name")
    .in("place_name", PLACEHOLDER_NAMES);

  if (error) {
    console.error("Błąd:", error);
    process.exit(1);
  }

  if (!pins || pins.length === 0) {
    console.log("Nie znaleziono żadnego pin'a o tych nazwach");
    return;
  }

  console.log(`Znaleziono ${pins.length} pin(ów) placeholder'owych:\n`);
  for (const p of pins) {
    console.log(`  - ${p.place_name}  [pin:${p.id.slice(0, 8)}  route:${p.route_id?.slice(0, 8) ?? "?"}]`);
  }

  const routeIds = [...new Set(pins.map((p) => p.route_id).filter(Boolean))];
  console.log(`\nUnikatowych route'ów dotkniętych: ${routeIds.length}\n`);

  const { data: routes, error: rerr } = await sb
    .from("routes")
    .select("id, title, city, user_id, status, created_at")
    .in("id", routeIds);

  if (rerr) {
    console.error("Błąd routes:", rerr);
    return;
  }

  console.log("Route'y do (potencjalnego) usunięcia:\n");
  for (const r of routes ?? []) {
    console.log(`  ${r.id}`);
    console.log(`    title:      ${r.title}`);
    console.log(`    city:       ${r.city}`);
    console.log(`    status:     ${r.status}`);
    console.log(`    user_id:    ${r.user_id}`);
    console.log(`    created_at: ${r.created_at}`);
    console.log("");
  }

  console.log("---");
  console.log("Wszystkie pin'y w tych route'ach:\n");

  const { data: allPins } = await sb
    .from("pins")
    .select("place_name, route_id, pin_order")
    .in("route_id", routeIds)
    .order("route_id")
    .order("pin_order");

  let currentRoute: string | null = null;
  for (const p of allPins ?? []) {
    if (p.route_id !== currentRoute) {
      currentRoute = p.route_id;
      const route = routes?.find((r) => r.id === currentRoute);
      console.log(`\n${currentRoute?.slice(0, 8)} - "${route?.title}":`);
    }
    const isPlaceholder = PLACEHOLDER_NAMES.includes(p.place_name) ? "  ← PLACEHOLDER" : "";
    console.log(`  ${String(p.pin_order).padStart(2)}. ${p.place_name}${isPlaceholder}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
