import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

// Always return 200 with a result envelope so supabase.functions.invoke surfaces
// our error codes in `data` rather than swallowing them as a generic non-2xx error.
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
      console.error("[upgrade-business-account] missing env", {
        hasUrl: !!SUPABASE_URL,
        hasAnon: !!ANON_KEY,
        hasService: !!SERVICE_ROLE_KEY,
      });
      return ok({ ok: false, code: "env_missing", message: "Brak konfiguracji serwera. Daj znać Trasa team." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return ok({ ok: false, code: "no_auth", message: "Sesja wygasła. Odśwież stronę i spróbuj ponownie." });
    }

    const { email: rawEmail, password } = await req.json();
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

    // Verify caller identity using JWT from Authorization header
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("[upgrade-business-account] invalid session", userError);
      return ok({ ok: false, code: "invalid_session", message: "Sesja nieprawidłowa. Odśwież stronę." });
    }

    // Use admin API to update email + password AND mark email as confirmed.
    // email_confirm: true bypasses Supabase's "Confirm change of email" mail,
    // so the user never receives a second (generic Supabase-branded) email
    // and never lands on /set-password — they go straight to their dashboard.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
    });

    if (updateError) {
      const msg = updateError.message?.toLowerCase() ?? "";
      console.error("[upgrade-business-account] admin update failed", {
        message: updateError.message,
        status: (updateError as any).status,
        code: (updateError as any).code,
        user_id: user.id,
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

    return ok({ ok: true, user_id: user.id });
  } catch (err: any) {
    console.error("[upgrade-business-account] unexpected error", err);
    return ok({ ok: false, code: "server_error", message: err.message ?? "Nieoczekiwany błąd serwera." });
  }
});
