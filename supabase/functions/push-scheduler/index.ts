import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .order("user_id");

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions to notify", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(subscriptions.map((s) => s.user_id))];

    // For each user, check if they have ongoing trips and send reminder
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of uniqueUserIds) {
      // Check for ongoing/planning trips
      const { data: activeTrips } = await supabase
        .from("route_folders")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_trip", true)
        .limit(1);

      // Check for today's routes (routes with today's date)
      const today = new Date().toISOString().split("T")[0];
      const { data: todayRoutes } = await supabase
        .from("routes")
        .select("id, title, city")
        .eq("user_id", userId)
        .eq("status", "published")
        .gte("start_date", today)
        .lte("start_date", today)
        .limit(1);

      let title = "📍 Trasa czeka!";
      let body = "Zaplanuj jutrzejszy dzień lub zapisz wspomnienia z dzisiejszego.";
      let url = "/home";

      if (todayRoutes && todayRoutes.length > 0) {
        const route = todayRoutes[0];
        title = `📍 Dziś: ${route.title}`;
        body = route.city
          ? `Twój plan na ${route.city} jest gotowy. Sprawdź!`
          : "Sprawdź swój plan na dzisiaj!";
        url = `/day/${route.id}`;
      } else if (activeTrips && activeTrips.length > 0) {
        title = `🗺️ ${activeTrips[0].name}`;
        body = "Zapisz wspomnienia z dzisiejszego dnia!";
      }

      // Call send-push function
      try {
        const pushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ user_id: userId, title, body, url }),
          }
        );
        const pushResult = await pushResponse.json();
        totalSent += pushResult.sent || 0;
        totalFailed += pushResult.failed || 0;
      } catch (err) {
        console.error(`Failed to send push to user ${userId}:`, err);
        totalFailed++;
      }
    }

    console.log(`Push scheduler done: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        message: "Push scheduler completed",
        users_notified: uniqueUserIds.length,
        total_sent: totalSent,
        total_failed: totalFailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("push-scheduler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
