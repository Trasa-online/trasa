import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

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
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, username, waitlist_id } = await req.json();

    if (!email || !username) {
      return new Response(JSON.stringify({ error: "email and username required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try invite link first; fall back to magiclink if user already exists
    let inviteLink: string;
    let invitedUserId: string;
    let isExistingUser = false;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { username },
        redirectTo: "https://trasa.lovable.app/set-password",
      },
    });

    if (linkError && linkError.message?.includes("already been registered")) {
      // User exists — generate a magiclink instead
      const { data: mlData, error: mlError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: "https://trasa.lovable.app/set-password",
        },
      });

      if (mlError || !mlData?.properties?.action_link) {
        console.error("magiclink fallback error:", mlError);
        return new Response(JSON.stringify({ error: "Failed to generate link for existing user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      inviteLink = mlData.properties.action_link;
      invitedUserId = mlData.user.id;
      isExistingUser = true;
    } else if (linkError || !linkData?.properties?.action_link) {
      console.error("generateLink error:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate invite link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      inviteLink = linkData.properties.action_link;
      invitedUserId = linkData.user.id;
    }

    // Create profile only for new users
    if (!isExistingUser) {
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
      JSON.stringify({ link: inviteLink, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("invite-user error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
