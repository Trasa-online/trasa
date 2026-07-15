import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Soft-delete konta (panel ops). Operacja NIEODWRACALNA-w-skutkach -> tylko
// super_admin, z powodem i audytem. Nie kasuje danych na twardo: flaga
// profiles.deleted_at + ban w Auth (blokuje logowanie, odwracalny).
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

    // Gate: super_admin (destrukcyjne).
    const { data: sa } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!sa) return json({ error: "Forbidden - wymagany super_admin" }, 403);

    const body = await req.json();
    const targetId = (body.user_id ?? "").toString();
    const reason = body.reason ? body.reason.toString().slice(0, 500) : "";
    if (!targetId) return json({ error: "user_id required" }, 400);
    if (!reason) return json({ error: "reason wymagany" }, 400);
    if (targetId === user.id) return json({ error: "Nie możesz usunąć własnego konta" }, 400);

    // Nie kasuj kont z jakąkolwiek rolą admina (operator/admin/super_admin).
    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetId);
    const hasAdminRole = (targetRoles ?? []).some((r: any) => ["admin", "super_admin", "operator"].includes(r.role));
    if (hasAdminRole) return json({ error: "Nie można usunąć konta z rolą w panelu" }, 400);

    const now = new Date().toISOString();
    await admin.from("profiles").update({ deleted_at: now, deleted_by: user.id, deletion_reason: reason }).eq("id", targetId);

    // Ban w Auth (~100 lat) - blokuje logowanie, bez utraty danych.
    await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });

    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: "account.soft_delete",
      target_type: "profile",
      target_id: targetId,
      metadata: { reason },
    });

    return json({ ok: true, user_id: targetId });
  } catch (err: any) {
    console.error("[admin-delete-account]", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
