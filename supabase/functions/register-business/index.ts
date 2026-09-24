import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildActivationHtml, buildActivationText } from "./activation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

// Prosty in-memory rate limit per IP (best-effort - resetuje sie przy cold start).
const ipHits = new Map<string, number[]>();
function rateLimited(ip: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { ipHits.set(ip, arr); return true; }
  arr.push(now); ipHits.set(ip, arr);
  return false;
}


// ⚠️ TRWALY limit w BAZIE obok pamieciowego (audyt naduzyc 2026-09-24). Pamiec funkcji
// brzegowej zyje tylko w jednej instancji, a Deno Deploy trzyma ich wiele naraz i podnosi
// nowe pod obciazeniem - czyli dokladnie wtedy, gdy limit jest potrzebny. Licznik w bazie
// jest wspolny dla wszystkich instancji. Fail-open: blad bazy nie moze zablokowac rejestracji.
async function dbRateLimited(bucket: string, limit: number, windowMinutes: number): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !key) return false;
    const res = await fetch(`${url}/rest/v1/rpc/try_consume_rate_limit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_bucket: bucket, p_limit: limit, p_window_minutes: windowMinutes }),
    });
    if (!res.ok) return false;
    return (await res.json()) === false;
  } catch {
    return false;
  }
}

const REDIRECT_TO = "https://spontaway.com/#/set-password-biznes";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(ip) || await dbRateLimited(`bizreg:ip:${ip}`, 20, 60) || await dbRateLimited("bizreg:all", 300, 60)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rawEmail = body.email;
    const placeName = (body.place_name ?? "").toString().trim();
    const phone = (body.phone ?? "").toString().trim();
    // Kod QR z wizytowki drukowanej (2026-09-21) - opcjonalny; nieznany albo juz przejety
    // token po prostu ignorujemy (rejestracja i tak ma przejsc).
    const qrToken = /^[a-z0-9]{4,32}$/.test(String(body.qr_token ?? "").toLowerCase()) ? String(body.qr_token).toLowerCase() : null;

    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");
    if (!placeName) throw new Error("place_name required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // [H5] Trwaly rate-limit (per IP i per email) - chroni przed masowa rejestracja
    // i email-bombingiem. In-memory wyzej to fast-path; to jest twarda bramka.
    // Wymaga tabeli fn_throttle (migracja 20260804); brak -> degraduje (in-memory zostaje).
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [ipHit, emailHit] = await Promise.all([
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `rb:ip:${ip}`).gte("created_at", since),
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `rb:email:${email}`).gte("created_at", since),
      ]);
      if ((ipHit.count ?? 0) >= 10 || (emailHit.count ?? 0) >= 3) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("fn_throttle").insert([{ bucket: `rb:ip:${ip}` }, { bucket: `rb:email:${email}` }]);
    } catch (_e) { /* tabela moze jeszcze nie istniec - polegamy na in-memory */ }

    const safeName = placeName.slice(0, 120);

    // ── Generuj link aktywacyjny (invite dla nowego, recovery/magiclink dla istniejacego) ──
    // Ta sama logika co invite-user: budujemy link BEZPOSREDNIO z token_hash (nie action_link),
    // bo admin-generated link nie ma client-side code_verifier -> verifyOtp({token_hash,type})
    // w SetPassword nie wymaga verifiera.
    let hashedToken: string | undefined;
    let linkType: "invite" | "recovery" | "magiclink" | undefined;
    let userId: string | undefined;
    let isExistingUser = false;

    const invite = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { username: safeName }, redirectTo: REDIRECT_TO },
    });

    if (!invite.error && invite.data?.properties?.hashed_token) {
      hashedToken = invite.data.properties.hashed_token;
      linkType = "invite";
      userId = invite.data.user.id;
    } else {
      // User juz istnieje -> link recovery (ustawi haslo dla istniejacego konta)
      const recovery = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: REDIRECT_TO },
      });
      if (!recovery.error && recovery.data?.properties?.hashed_token) {
        hashedToken = recovery.data.properties.hashed_token;
        linkType = "recovery";
        userId = recovery.data.user.id;
        isExistingUser = true;
      } else {
        const magic = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: REDIRECT_TO },
        });
        if (!magic.error && magic.data?.properties?.hashed_token) {
          hashedToken = magic.data.properties.hashed_token;
          linkType = "magiclink";
          userId = magic.data.user.id;
          isExistingUser = true;
        } else {
          throw new Error(
            magic.error?.message ?? recovery.error?.message ?? invite.error?.message ?? "Nie udało się wygenerować linku",
          );
        }
      }
    }

    if (!userId || !hashedToken || !linkType) throw new Error("Brak danych linku");

    // ── Profil (tylko dla nowego usera) ──
    if (!isExistingUser) {
      await admin.from("profiles").upsert({
        id: userId,
        username: safeName,
        onboarding_completed: false,
      }, { onConflict: "id" });
    }

    // ── Wizytowka: utworz jesli owner nie ma jeszcze zadnej ──
    // is_active=false: wizytowka NIE jest publicznie widoczna dopoki lokal nie uzupelni
    // profilu (nazwa/kategoria/zdjecie) w panelu.
    // is_draft: dla NOWEGO konta false (to juz realne konto biznesowe). Dla ISTNIEJACEGO
    // usera TRUE - dopoki nie kliknie linku z maila (SetPassword zdejmuje szkic). Bez tego
    // kazdy mogl wpisac cudzy mail + dowolna nazwe i przypiac wizytowke do cudzego konta,
    // a BusinessGuard od tej chwili wpychal ofiare do panelu przy kazdej nawigacji
    // (audyt 2026-09-14). Szkic nie wymusza redirectu.
    let bp: { id: string; place_id: string | null } | null = null;
    const existingBp = await admin
      .from("business_profiles")
      .select("id, place_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (existingBp.data?.id) {
      bp = existingBp.data as { id: string; place_id: string | null };
    } else {
      const created = await admin
        .from("business_profiles")
        .insert({
          owner_user_id: userId,
          business_name: safeName,
          phone: phone ? phone.slice(0, 40) : null,
          email,
          is_draft: isExistingUser,
          is_active: false,
          plan: "zero",
        })
        .select("id, place_id")
        .single();
      if (created.error) throw new Error(`business_profiles insert: ${created.error.message}`);
      bp = created.data as { id: string; place_id: string | null };
    }

    // ── Kod QR: przypnij token do wizytowki, a miejsce z tokenu - do wizytowki ──
    // Token wskazuje na wiersz `places` w stanie zero (albo jeszcze na nic). Podpiecie
    // `place_id` juz tu (nie dopiero przy zatwierdzeniu) = admin zatwierdza TE wizytowke,
    // bez dopasowywania po nazwie, a kod od tej chwili nie ma guzika "To moj lokal".
    if (qrToken && bp) {
      const { data: qr } = await admin.from("place_qr_codes").select("token, place_id, claimed_by_profile_id").eq("token", qrToken).maybeSingle();
      if (qr && !qr.claimed_by_profile_id) {
        await admin.from("place_qr_codes").update({ claimed_by_profile_id: bp.id, claimed_at: new Date().toISOString() }).eq("token", qrToken);
        if (qr.place_id && !bp.place_id) {
          const { data: taken } = await admin.from("business_profiles").select("id").eq("place_id", qr.place_id).neq("id", bp.id).limit(1);
          if (!taken?.length) await admin.from("business_profiles").update({ place_id: qr.place_id }).eq("id", bp.id);
        }
      }
    }

    // ── Link aktywacyjny do appki ──
    // token_hash w realnym query (przed #) zeby SetPassword odczytal z window.location.search,
    // hash route po # zeby HashRouter trafil na /set-password-biznes.
    const activationUrl = `https://spontaway.com/?token_hash=${hashedToken}&type=${linkType}#/set-password-biznes`;

    // ── Wyslij branded mail przez Resend ──
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "spontaway <hello@spontaway.com>",
        to: [email],
        subject: "Aktywuj konto biznesowe w spontaway",
        html: buildActivationHtml({ businessName: safeName, activationUrl }),
        text: buildActivationText({ businessName: safeName, activationUrl }),
      }),
    });

    const mail = await res.json();
    if (!res.ok) throw new Error(`resend: ${JSON.stringify(mail)}`);

    // [H5] Generyczna odpowiedz - NIE ujawniamy czy konto juz istnialo (email oracle).
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[register-business]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
