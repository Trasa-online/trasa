import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Usuniecie wizytowki biznesowej (panel ops). Destrukcyjne -> super_admin +
// audyt. Usuwa wiersz business_profiles; powiazane 'places' zostaje (niezalezne).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: sa } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!sa) return json({ error: "Forbidden - wymagany super_admin" }, 403);

    const body = await req.json();
    const profileId = (body.profile_id ?? "").toString();
    const reason = body.reason ? body.reason.toString().slice(0, 500) : "";
    if (!profileId) return json({ error: "profile_id required" }, 400);

    const { data: bp } = await admin.from("business_profiles").select("id, business_name, place_id").eq("id", profileId).maybeSingle();
    if (!bp) return json({ error: "Nie znaleziono wizytowki" }, 404);

    const { error: delErr } = await admin.from("business_profiles").delete().eq("id", profileId);
    if (delErr) return json({ error: `delete: ${delErr.message}` }, 500);

    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: "business.delete",
      target_type: "business_profile",
      target_id: profileId,
      metadata: { business_name: bp.business_name, place_id: bp.place_id, reason },
    });

    return json({ ok: true, profile_id: profileId });
  } catch (err: any) {
    console.error("[admin-delete-business]", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
