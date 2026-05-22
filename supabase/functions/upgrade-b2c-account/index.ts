import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error("[upgrade-b2c-account] missing env");
      return ok({ ok: false, code: "env_missing", message: "Brak konfiguracji serwera." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return ok({ ok: false, code: "no_auth", message: "Sesja wygasła. Odśwież stronę." });
    }

    const { email: rawEmail, password, first_name, username, referral_code } = await req.json();
    if (!rawEmail || typeof rawEmail !== "string" || !password || typeof password !== "string") {
      return ok({ ok: false, code: "bad_input", message: "Brakuje emaila lub hasła." });
    }
    const email = rawEmail.trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) {
      return ok({ ok: false, code: "bad_email", message: "Email ma nieprawidłowy format." });
    }
    if (password.length < 6) {
      return ok({ ok: false, code: "bad_password", message: "Hasło musi mieć co najmniej 6 znaków." });
    }

    // Dekoduj JWT bezposrednio z Authorization header zamiast supabaseUser.auth.getUser()
    // (getUser() bywa zawodne w Deno + anon tokens - czasem zwraca error mimo waznego JWT).
    // Trust signing Supabase, weryfikujemy istnienie usera przez admin API ponizej.
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("invalid jwt format");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      userId = payload?.sub ?? null;
    } catch (e) {
      console.error("[upgrade-b2c-account] jwt decode failed", e);
    }
    if (!userId) {
      return ok({ ok: false, code: "invalid_session", message: "Sesja nieprawidłowa. Odśwież stronę." });
    }

    const safeFirstName = typeof first_name === "string" ? first_name.trim().slice(0, 80) : "";
    const safeUsername = typeof username === "string" ? username.trim().slice(0, 50) : "";
    const safeReferral = typeof referral_code === "string" ? referral_code.trim().slice(0, 50) : null;

    // Admin API: update email + password, set email_confirm: true (pomija Supabase
    // "Change Email Address" mail). Zapisz tez first_name/username w user_metadata.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Weryfikacja ze user istnieje (anti-spoofed-JWT) - admin getUserById nie polega
    // na zewnetrznym auth call jak supabaseUser.auth.getUser().
    const { data: { user: existingUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError || !existingUser) {
      console.error("[upgrade-b2c-account] user not found", { userId, error: getUserError });
      return ok({ ok: false, code: "invalid_session", message: "Sesja nieprawidłowa. Odśwież stronę." });
    }
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: safeFirstName || undefined,
        username: safeUsername || undefined,
        referral_code: safeReferral || undefined,
      },
    });

    if (updateError) {
      const msg = updateError.message?.toLowerCase() ?? "";
      console.error("[upgrade-b2c-account] admin update failed", {
        message: updateError.message,
        user_id: userId,
        email,
      });
      if (msg.includes("already") || msg.includes("duplicate") || msg.includes("registered")) {
        return ok({ ok: false, code: "email_in_use", message: "Ten email jest już użyty na innym koncie." });
      }
      return ok({
        ok: false,
        code: "update_failed",
        message: updateError.message ?? "Nie udało się utworzyć konta.",
      });
    }

    return ok({ ok: true, user_id: userId, first_name: safeFirstName });
  } catch (err: any) {
    console.error("[upgrade-b2c-account] unexpected error", err);
    return ok({ ok: false, code: "server_error", message: err.message ?? "Nieoczekiwany błąd serwera." });
  }
});
