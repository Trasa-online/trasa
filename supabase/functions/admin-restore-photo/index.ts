// Przywrocenie zdjecia odrzuconego przez SafeSearch ("falszywy alarm").
// Wolane z panelu admina: supabase.functions.invoke("admin-restore-photo", { body: { log_id } }).
//
// Dlaczego funkcja, a nie RPC w SQL: przeniesienie BAJTOW miedzy bucketami idzie przez Storage
// API, ktore nie jest dostepne z poziomu SQL. Kontrakt dla panelu jest ten sam co przy RPC.
//
// Co robi (kolejnosc ma znaczenie - najpierw plik, potem referencja):
//  1. kopiuje plik z prywatnej kwarantanny do wlasciwego PUBLICZNEGO bucketa,
//  2. odtwarza referencje wg `context` + `target` z wpisu w logu,
//  3. stempluje log (restored_at, restored_url, reviewed_at, reviewer_note),
//  4. kasuje plik z kwarantanny (zdjecie wrocilo, kopia niepotrzebna).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "forbidden" }, 403);

    const { log_id, note } = await req.json().catch(() => ({ log_id: null, note: null }));
    if (!log_id) return json({ error: "log_id required" }, 400);

    const { data: row } = await admin.from("image_moderation_log").select("*").eq("id", log_id).maybeSingle();
    if (!row) return json({ error: "log entry not found" }, 404);
    if (row.restored_at) return json({ ok: true, already_restored: true, url: row.restored_url });
    if (!row.quarantine_path) return json({ error: "no quarantined file - nothing to restore" }, 409);

    // 1. plik z kwarantanny
    const dl = await admin.storage.from("moderation-quarantine").download(row.quarantine_path);
    if (dl.error || !dl.data) return json({ error: `quarantine download: ${dl.error?.message}` }, 500);
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    const target = (row.target ?? {}) as Record<string, string | null>;
    const owner = row.user_id ?? user.id;
    const rid = crypto.randomUUID();
    const ctx = String(row.context ?? "");

    const bucket = ctx === "place_photo" ? "place-photos" : "route-images";
    const path = ctx === "place_photo"
      ? `${owner}/${rid}.jpg`
      : `${owner}/${target.route_id ?? "restored"}/${ctx === "pin_photo" ? "pin" : "gal"}_restored_${rid}.jpg`;

    const up = await admin.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (up.error) return json({ error: `upload: ${up.error.message}` }, 500);
    const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
    const url = pub.publicUrl;

    // 2. referencja wg kontekstu
    let restoredRef = "none";
    if (ctx === "place_photo" && target.place_key) {
      const { error } = await admin.from("place_photos").insert({
        place_key: target.place_key, place_name: target.place_name ?? "", city: target.city ?? null,
        user_id: owner, photo_url: url,
      });
      if (error) return json({ error: `place_photos: ${error.message}` }, 500);
      restoredRef = "place_photos";
    } else if (ctx === "pin_photo" && target.route_id && target.place_name) {
      const { error } = await admin.from("pin_photos").insert({
        route_id: target.route_id, place_name: target.place_name, user_id: owner, url,
      });
      if (error) return json({ error: `pin_photos: ${error.message}` }, 500);
      restoredRef = "pin_photos";
    } else if (ctx === "trip_gallery" && target.route_id) {
      const { data: route } = await admin.from("routes").select("review_photos").eq("id", target.route_id).maybeSingle();
      const photos = Array.isArray(route?.review_photos) ? route!.review_photos : [];
      const { error } = await admin.from("routes").update({ review_photos: [...photos, url] }).eq("id", target.route_id);
      if (error) return json({ error: `routes.review_photos: ${error.message}` }, 500);
      restoredRef = "routes.review_photos";
    }
    // Brak/niepelny target (np. wpis sprzed dodania kolumny): plik wraca do bucketa, referencji
    // nie odtwarzamy - panel dostaje URL i moze go wstawic recznie.

    // 3. stempel w logu + 4. sprzatanie kwarantanny
    await admin.from("image_moderation_log").update({
      restored_at: new Date().toISOString(),
      restored_url: url,
      reviewed_at: new Date().toISOString(),
      reviewer_note: (typeof note === "string" && note.trim()) || "fałszywy alarm - przywrócono",
    }).eq("id", log_id);
    await admin.storage.from("moderation-quarantine").remove([row.quarantine_path]);

    return json({ ok: true, url, restored_reference: restoredRef, context: ctx });
  } catch (e) {
    console.error("[admin-restore-photo]", e instanceof Error ? e.message : e);
    return json({ error: "internal error" }, 500);
  }
});
