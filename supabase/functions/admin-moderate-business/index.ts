import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Moderacja wizytowki (panel ops). Operacja z audytem -> przez edge (service-role),
// nie bezposrednio z klienta. Dostep: kazdy admin (operator + super_admin).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Weryfikacja: zalogowany + rola admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden - brak roli admin" }, 403);

    // ── Wejscie ──
    const body = await req.json();
    const profileId = (body.profile_id ?? "").toString();
    const action = (body.action ?? "").toString();
    const reason = body.reason ? body.reason.toString().slice(0, 500) : null;
    if (!profileId) return json({ error: "profile_id required" }, 400);
    if (action !== "approve" && action !== "reject") return json({ error: "action must be approve|reject" }, 400);
    if (action === "reject" && !reason) return json({ error: "reason wymagany przy odrzuceniu" }, 400);

    const { data: bp } = await admin
      .from("business_profiles")
      .select("id, business_name, moderation_status, activated_at, place_id, city, main_category, subcategories, street, address, latitude, longitude, cover_image_url, logo_url")
      .eq("id", profileId)
      .maybeSingle();
    if (!bp) return json({ error: "Nie znaleziono wizytowki" }, 404);

    const now = new Date().toISOString();
    const update = action === "approve"
      ? {
          moderation_status: "approved",
          is_verified: true,
          is_active: true,
          activated_at: bp.activated_at ?? now,
          moderated_at: now,
          moderated_by: user.id,
          moderation_note: reason,
        }
      : {
          moderation_status: "rejected",
          is_active: false,
          is_verified: false,
          moderated_at: now,
          moderated_by: user.id,
          moderation_note: reason,
        };

    const { error: upErr } = await admin.from("business_profiles").update(update).eq("id", profileId);
    if (upErr) return json({ error: `update: ${upErr.message}` }, 500);

    // ── Approve: podlinkuj do miejsca w `places` (jesli jeszcze nie) ──
    // Self-service wizytowki maja place_id=NULL. Bez wpisu w places sa niewidoczne
    // w apce i nie da sie dodawac postow (business_posts.place_id -> places).
    // Na akcept tworzymy miejsce z danych wizytowki i linkujemy place_id.
    let linkedPlaceId: string | null = bp.place_id ?? null;
    if (action === "approve" && !bp.place_id) {
      // subcategories trzyma ETYKIETY (np. "Kawiarnia") - mapujemy na granularne id
      // (places.category musi byc id: cafe/restaurant/... zeby getMainCategoryFor dzialal).
      const LABEL_TO_ID: Record<string, string> = {
        "Restauracja": "restaurant", "Kawiarnia": "cafe", "Bar / Pub": "bar", "Bar": "bar",
        "Muzeum": "museum", "Zabytek": "monument", "Galeria": "gallery",
        "Doświadczenie": "experience", "Targ": "market", "Sklep": "shopping", "Klub": "club",
        "Park": "park", "Punkt widokowy": "viewpoint",
      };
      const DEFAULT_CAT: Record<string, string> = { food: "restaurant", culture: "museum", attractions: "experience", nature: "park" };
      const firstSub = Array.isArray(bp.subcategories) ? bp.subcategories[0] : null;
      const category = (firstSub && LABEL_TO_ID[firstSub]) || DEFAULT_CAT[bp.main_category as string] || "restaurant";
      const { data: place, error: placeErr } = await admin
        .from("places")
        .insert({
          place_name: bp.business_name || "Lokal",
          city: bp.city || "Warszawa",
          category,
          address: bp.address || bp.street || null,
          latitude: bp.latitude ?? null,
          longitude: bp.longitude ?? null,
          photo_url: bp.cover_image_url || bp.logo_url || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (!placeErr && place) {
        linkedPlaceId = place.id;
        await admin.from("business_profiles").update({ place_id: place.id }).eq("id", profileId);
      } else {
        console.warn("[admin-moderate-business] nie udalo sie utworzyc places:", placeErr?.message);
      }
    }

    // ── Audit log (append-only, service-role) ──
    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: `business.${action}`,
      target_type: "business_profile",
      target_id: profileId,
      metadata: { business_name: bp.business_name, reason, prev_status: bp.moderation_status, place_id: linkedPlaceId },
    });

    return json({ ok: true, profile_id: profileId, status: update.moderation_status, place_id: linkedPlaceId });
  } catch (err: any) {
    console.error("[admin-moderate-business]", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
