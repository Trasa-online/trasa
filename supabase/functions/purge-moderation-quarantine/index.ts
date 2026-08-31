// Sprzatanie kwarantanny moderacji: kasuje PLIKI i wpisy starsze niz N dni (domyslnie 90).
// Wolane przez pg_cron (funkcja public.purge_moderation_quarantine, codziennie 3:30 UTC)
// z naglowkiem x-trigger-secret - tym samym sekretem z Vaulta co kanal push.
// Wpisy z restored_at zostaja jako slad decyzji (plik i tak jest juz skasowany przy przywroceniu).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_TRIGGER_SECRET");
  if (!secret || req.headers.get("x-trigger-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const days = Number((await req.json().catch(() => ({}))).older_than_days ?? 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: rows, error } = await admin.from("image_moderation_log")
    .select("id, quarantine_path").lt("created_at", cutoff).limit(500);
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ ok: true, deleted: 0, cutoff });

  const paths = rows.map((r) => r.quarantine_path).filter(Boolean) as string[];
  if (paths.length) {
    const { error: rmErr } = await admin.storage.from("moderation-quarantine").remove(paths);
    if (rmErr) console.warn("[purge-moderation-quarantine] storage:", rmErr.message);
  }
  const { error: delErr } = await admin.from("image_moderation_log").delete().in("id", rows.map((r) => r.id));
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true, deleted: rows.length, files: paths.length, cutoff });
});
