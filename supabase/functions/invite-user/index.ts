import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
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
      console.error("auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin via user_roles table
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    console.log("role check for user", user.id, "→ roleData:", roleData, "roleError:", roleError);

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden – no admin role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, username, waitlist_id, isBusiness } = await req.json();

    if (!email || !username) {
      return new Response(JSON.stringify({ error: "email and username required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = isBusiness
      ? "https://trasa.travel/set-password?type=business"
      : "https://trasa.travel/set-password";

    let inviteLink: string | undefined;
    let invitedUserId: string | undefined;
    let isExistingUser = false;

    // 1. Try invite (new user path)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { username },
        redirectTo,
      },
    });

    console.log("invite result:", linkError?.message, "action_link:", linkData?.properties?.action_link?.slice(0, 60));

    if (!linkError && linkData?.properties?.action_link) {
      inviteLink = linkData.properties.action_link;
      invitedUserId = linkData.user.id;
    } else {
      // User already exists or invite failed — try recovery link
      const { data: recData, error: recError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      console.log("recovery result:", recError?.message, "action_link:", recData?.properties?.action_link?.slice(0, 60));

      if (!recError && recData?.properties?.action_link) {
        inviteLink = recData.properties.action_link;
        invitedUserId = recData.user.id;
        isExistingUser = true;
      } else {
        // Last resort: magiclink
        const { data: mlData, error: mlError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });

        console.log("magiclink result:", mlError?.message, "action_link:", mlData?.properties?.action_link?.slice(0, 60));

        if (!mlError && mlData?.properties?.action_link) {
          inviteLink = mlData.properties.action_link;
          invitedUserId = mlData.user.id;
          isExistingUser = true;
        } else {
          const errMsg = mlError?.message ?? recError?.message ?? linkError?.message ?? "Failed to generate link";
          console.error("all link types failed:", { linkError, recError, mlError });
          return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

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
    console.error("invite-user error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
