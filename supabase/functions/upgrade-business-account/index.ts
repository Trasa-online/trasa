import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email: rawEmail, password } = await req.json();
    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    if (!password || typeof password !== "string") throw new Error("password required");
    const email = rawEmail.trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");
    if (password.length < 6) throw new Error("password too short");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity using JWT from Authorization header
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      if (msg.includes("already") || msg.includes("duplicate")) {
        return new Response(JSON.stringify({ error: "email_in_use" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw updateError;
    }

    return new Response(JSON.stringify({ ok: true, user_id: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[upgrade-business-account]", err);
    return new Response(JSON.stringify({ error: err.message ?? "unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
