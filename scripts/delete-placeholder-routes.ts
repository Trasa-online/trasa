import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://chxphfcpehxshvijqtlf.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const ROUTE_IDS = [
  "c3bdaa70-5d32-4671-9436-577afaf84771", // Warszawa — Dzień 1
  "7a03f2c6-a55b-4b7a-93e6-de82c7b60c60", // Warszawa — Dzień 2
];

async function main() {
  // 1. Count pins about to be deleted
  const { count: pinsBefore, error: countErr } = await sb
    .from("pins")
    .select("*", { count: "exact", head: true })
    .in("route_id", ROUTE_IDS);

  if (countErr) {
    console.error("Count error:", countErr);
    process.exit(1);
  }

  console.log(`Pin'ów do usunięcia: ${pinsBefore}`);
  console.log(`Route'ów do usunięcia: ${ROUTE_IDS.length}\n`);

  // 2. Delete pins first (in case no CASCADE)
  const { error: pinDelErr, count: pinsDeleted } = await sb
    .from("pins")
    .delete({ count: "exact" })
    .in("route_id", ROUTE_IDS);

  if (pinDelErr) {
    console.error("Pin delete error:", pinDelErr);
    process.exit(1);
  }
  console.log(`✓ Usunięto pin'ów: ${pinsDeleted}`);

  // 3. Delete routes
  const { error: routeDelErr, count: routesDeleted } = await sb
    .from("routes")
    .delete({ count: "exact" })
    .in("id", ROUTE_IDS);

  if (routeDelErr) {
    console.error("Route delete error:", routeDelErr);
    process.exit(1);
  }
  console.log(`✓ Usunięto route'ów: ${routesDeleted}`);

  // 4. Sanity check — confirm gone
  const { data: remaining } = await sb
    .from("routes")
    .select("id")
    .in("id", ROUTE_IDS);

  const { count: pinsRemaining } = await sb
    .from("pins")
    .select("*", { count: "exact", head: true })
    .in("route_id", ROUTE_IDS);

  console.log(`\nVerification:`);
  console.log(`  routes left with those IDs: ${remaining?.length ?? 0}`);
  console.log(`  pins left with those route_ids: ${pinsRemaining}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
