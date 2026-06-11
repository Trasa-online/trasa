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

// Decode JWT payload (RFC 7519 base64url with proper padding for atob).
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    b64 = b64 + "=".repeat(padLen);
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
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
      return ok({ ok: false, code: "env_missing", message: "Brak konfiguracji serwera." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("[upgrade-business-account] no auth header");
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

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3 metody weryfikacji w fallback (getUser bywa zawodne dla anon JWT w Deno):
    // 1) supabase-js getUser(token) - external call, najnowsze API
    // 2) JWT decode + admin.getUserById - no external call, trust Supabase signing
    // 3) JWT decode standalone - last resort
    let userId: string | null = null;
    let verifyMethod = "none";

    try {
      const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await anonClient.auth.getUser(token);
      if (user && !error) {
        userId = user.id;
        verifyMethod = "getUser";
      } else if (error) {
        console.warn("[upgrade-business-account] method1 getUser failed:", error.message);
      }
    } catch (e: any) {
      console.warn("[upgrade-business-account] method1 getUser threw:", e?.message ?? e);
    }

    if (!userId) {
      const payload = decodeJwtPayload(token);
      const sub = payload?.sub;
      if (sub && typeof sub === "string") {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(sub);
          if (data?.user && !error) {
            userId = data.user.id;
            verifyMethod = "decode+adminGet";
          } else if (error) {
            console.warn("[upgrade-business-account] method2 admin getUserById failed:", error.message);
          }
        } catch (e: any) {
          console.warn("[upgrade-business-account] method2 admin getUserById threw:", e?.message ?? e);
        }
      } else {
        console.warn("[upgrade-business-account] method2 jwt decode: no sub claim");
      }
    }

    // [C2] USUNIETO fallback "decode-trust": wczesniej, gdy obie zweryfikowane
    // sciezki zawiodly, braliśmy payload.sub z NIEPODPISANEGO (tylko base64) JWT
    // i ustawialiśmy email/haslo dla tego usera -> atakujacy forge'ujac sub mogl
    // przejac dowolne konto (takze admina). Teraz brak zweryfikowanego userId => odmowa.
    if (!userId) {
      console.error("[upgrade-business-account] all verify methods failed", {
        tokenLen: token.length,
        tokenPreview: token.slice(0, 20) + "...",
      });
      return ok({ ok: false, code: "invalid_session", message: "Sesja nieprawidłowa. Odśwież stronę." });
    }

    console.log("[upgrade-business-account] verified user", { userId, verifyMethod });

    // Use admin API to update email + password AND mark email as confirmed.
    // email_confirm: true bypasses Supabase's "Confirm change of email" mail,
    // so the user never receives a second (generic Supabase-branded) email
    // and never lands on /set-password — they go straight to their dashboard.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
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
        user_id: userId,
        email,
      });
      if (msg.includes("already") || msg.includes("duplicate") || msg.includes("registered")) {
        return ok({ ok: false, code: "email_in_use", message: "Ten email jest już użyty na innym koncie." });
      }
      if (msg.includes("not found") || msg.includes("does not exist")) {
        return ok({ ok: false, code: "invalid_session", message: "Sesja nieprawidłowa. Odśwież stronę." });
      }
      return ok({
        ok: false,
        code: "update_failed",
        message: updateError.message ?? "Nie udało się utworzyć konta.",
      });
    }

    return ok({ ok: true, user_id: userId });
  } catch (err: any) {
    console.error("[upgrade-business-account] unexpected error", err);
    return ok({ ok: false, code: "server_error", message: err.message ?? "Nieoczekiwany błąd serwera." });
  }
});
