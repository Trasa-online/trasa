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
    //
    // NAJPIERW szukamy ISTNIEJACEGO miejsca w stanie zero (decyzja Nat 2026-09-21): lokal,
    // ktory userzy mieli juz w planach i kolekcjach (wiersz `places` zalozony przez
    // `ensure_place_from_photo` albo seed), ma dostac wizytowke biznesu NA TYM SAMYM wierszu -
    // wtedy `enrichWithBusinessProfile` naklada profil wszedzie, gdzie ten `places.id` wisi
    // (piny po UUID, `resolvePlaceDbId`, zakladka Miejsca). Do 21.09 funkcja zawsze wstawiala
    // NOWY wiersz, wiec w bazie zostawal duplikat (stan zero + biznes), a kolekcje userow
    // dalej pokazywaly stan zero.
    // Dopasowanie: nazwa + miasto (bez wielkosci liter), a gdy wizytowka nie ma miasta albo
    // nic nie pasuje - sama nazwa, ale TYLKO gdy jest dokladnie jeden kandydat (sieciowka
    // w dwoch miastach to dwa rozne lokale). Odpadaja wiersze podpiete juz pod INNA wizytowke.
    let linkedPlaceId: string | null = bp.place_id ?? null;
    let linkedExisting = false;
    if (action === "approve" && !bp.place_id) {
      const name = (bp.business_name ?? "").trim();
      const city = (bp.city ?? "").trim();
      const { data: takenRows } = await admin
        .from("business_profiles").select("place_id").not("place_id", "is", null).neq("id", profileId);
      const taken = new Set(((takenRows ?? []) as any[]).map((r) => r.place_id));
      const free = (rows: any[] | null) => (rows ?? []).filter((r) => !taken.has(r.id));
      let match: any = null;
      if (name) {
        if (city) {
          const { data } = await admin.from("places").select("id, city")
            .ilike("place_name", name).ilike("city", city).order("created_at", { ascending: true }).limit(5);
          match = free(data)[0] ?? null;
        }
        if (!match) {
          const { data } = await admin.from("places").select("id, city")
            .ilike("place_name", name).limit(5);
          const cands = free(data);
          if (cands.length === 1) match = cands[0];
        }
      }
      if (match) {
        // Uzupelniamy TYLKO braki - dane usera (kategoria z pinu, wspolrzedne) zostaja,
        // gdy lokal ich nie podal; okladka lokalu nadpisuje, bo to jego wizerunek.
        const { data: cur } = await admin.from("places")
          .select("id, address, latitude, longitude, photo_url, is_active").eq("id", match.id).maybeSingle();
        await admin.from("places").update({
          address: cur?.address || bp.address || bp.street || null,
          latitude: cur?.latitude ?? bp.latitude ?? null,
          longitude: cur?.longitude ?? bp.longitude ?? null,
          photo_url: bp.cover_image_url || bp.logo_url || cur?.photo_url || null,
          is_active: true,
        }).eq("id", match.id);
        linkedPlaceId = match.id;
        linkedExisting = true;
        await admin.from("business_profiles").update({ place_id: match.id, ...(city ? {} : match.city ? { city: match.city } : {}) }).eq("id", profileId);
      } else {
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
    }

    // ── Audit log (append-only, service-role) ──
    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: `business.${action}`,
      target_type: "business_profile",
      target_id: profileId,
      metadata: { business_name: bp.business_name, reason, prev_status: bp.moderation_status, place_id: linkedPlaceId, linked_existing: linkedExisting },
    });

    return json({ ok: true, profile_id: profileId, status: update.moderation_status, place_id: linkedPlaceId, linked_existing: linkedExisting });
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
