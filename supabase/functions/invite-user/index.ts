import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin via user_roles table
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden – no admin role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // ── check_emails action ────────────────────────────────────────────────
    if (body.action === "check_emails") {
      const emails: string[] = body.emails ?? [];
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.filter(u => u.email && emails.includes(u.email)).map(u => u.email!);
      return new Response(JSON.stringify({ existing_emails: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── generate invite link ───────────────────────────────────────────────
    const { email, username, waitlist_id, isBusiness } = body;

    if (!email || !username) {
      return new Response(JSON.stringify({ error: "email and username required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HashRouter (jeden build web+native): redirect MUSI miec '#/' inaczej trafia na
    // RootPage (route '/') zamiast na SetPassword -> user laduje na /home zamiast biznes.
    // 1:1 z dzialajacym resetem hasla (Auth.tsx: "https://spontaway.com/#/set-password").
    const redirectTo = isBusiness
      ? "https://spontaway.com/#/set-password-biznes"
      : "https://spontaway.com/#/set-password";

    let hashedToken: string | undefined;
    let linkType: "invite" | "recovery" | "magiclink" | undefined;
    let invitedUserId: string | undefined;
    let isExistingUser = false;

    // Try invite (new user)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { username }, redirectTo },
    });

    if (!linkError && linkData?.properties?.hashed_token) {
      hashedToken = linkData.properties.hashed_token;
      linkType = "invite";
      invitedUserId = linkData.user.id;
    } else {
      // User already exists — try recovery link
      const { data: recData, error: recError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      if (!recError && recData?.properties?.hashed_token) {
        hashedToken = recData.properties.hashed_token;
        linkType = "recovery";
        invitedUserId = recData.user.id;
        isExistingUser = true;
      } else {
        // Last resort: magiclink
        const { data: mlData, error: mlError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });

        if (!mlError && mlData?.properties?.hashed_token) {
          hashedToken = mlData.properties.hashed_token;
          linkType = "magiclink";
          invitedUserId = mlData.user.id;
          isExistingUser = true;
        } else {
          const errMsg = mlError?.message ?? recError?.message ?? linkError?.message ?? "Failed to generate link";
          return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Buduj link BEZPOSREDNIO do appki z token_hash (NIE Supabase action_link!).
    // Powod: action_link idzie przez /auth/v1/verify -> redirect z ?code= (PKCE), a
    // admin-generated link NIE ma client-side code_verifier -> exchangeCodeForSession
    // cicho failuje i zostaje stara (anonimowa) sesja -> "Updating password of an
    // anonymous user". verifyOtp({token_hash,type}) NIE wymaga verifiera (1:1 z mailami
    // confirm-signup). token_hash w realnym query (przed #) zeby SetPassword je odczytal
    // z window.location.search; hash route po # zeby HashRouter trafil na wlasciwa strone.
    const appPath = isBusiness ? "set-password-biznes" : "set-password";
    const inviteLink = `https://spontaway.com/?token_hash=${hashedToken}&type=${linkType}#/${appPath}`;

    // Create profile only for new users
    if (!isExistingUser && invitedUserId) {
      await supabaseAdmin.from("profiles").upsert({
        id: invitedUserId,
        username,
        onboarding_completed: false,
      }, { onConflict: "id" });
    }

    // Mark waitlist entry as invited
    if (waitlist_id) {
      await supabaseAdmin
        .from("waitlist")
        .update({ status: "invited", invited_at: new Date().toISOString() })
        .eq("id", waitlist_id);
    }

    return new Response(
      JSON.stringify({ link: inviteLink, email, userId: invitedUserId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
