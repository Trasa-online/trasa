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

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    for (const userId of uniqueUserIds) {
      // Priority order: tomorrow (trip preview) > yesterday (review reminder) > today (active)
      // Tylko jeden push per user per run zeby nie spamowac.
      const { data: tomorrowRoutes } = await supabase
        .from("routes")
        .select("id, title, city")
        .eq("user_id", userId)
        .eq("status", "published")
        .eq("start_date", tomorrow)
        .limit(1);

      const { data: yesterdayRoutes } = await supabase
        .from("routes")
        .select("id, title, city, review_photos")
        .eq("user_id", userId)
        .eq("status", "published")
        .eq("start_date", yesterday)
        .limit(1);

      const { data: todayRoutes } = await supabase
        .from("routes")
        .select("id, title, city")
        .eq("user_id", userId)
        .eq("status", "published")
        .eq("start_date", today)
        .limit(1);

      const { data: activeTrips } = await supabase
        .from("route_folders")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_trip", true)
        .limit(1);

      let title = "";
      let body = "";
      let url = "/home";

      if (tomorrowRoutes && tomorrowRoutes.length > 0) {
        // Trip reminder dnia przed
        const route = tomorrowRoutes[0];
        title = `🗺️ Jutro: ${route.title}`;
        body = route.city
          ? `Twoja trasa po ${route.city} startuje jutro. Sprawdź plan!`
          : "Twoja trasa startuje jutro. Sprawdź plan!";
        url = `/day-review?route=${route.id}`;
      } else if (yesterdayRoutes && yesterdayRoutes.length > 0) {
        // Review reminder dnia po - tylko jesli jeszcze nie ma recenzji ani zdjec
        const route = yesterdayRoutes[0];
        const hasReview = Array.isArray((route as any).review_photos) && (route as any).review_photos.length > 0;
        if (!hasReview) {
          title = `📷 Jak było wczoraj w ${route.city ?? route.title}?`;
          body = "Dodaj recenzje miejsc i zdjęcia do dziennika podróży";
          url = `/review-summary?route=${route.id}`;
        } else {
          continue; // ma juz recenzje, pomijamy
        }
      } else if (todayRoutes && todayRoutes.length > 0) {
        // Active trip today
        const route = todayRoutes[0];
        title = `📍 Dziś: ${route.title}`;
        body = route.city
          ? `Twój plan na ${route.city} jest gotowy. Sprawdź!`
          : "Sprawdź swój plan na dzisiaj!";
        url = `/day/${route.id}`;
      } else if (activeTrips && activeTrips.length > 0) {
        // Fallback - ma aktywna podroz, ale brak konkretnej daty
        title = `🗺️ ${activeTrips[0].name}`;
        body = "Zapisz wspomnienia z dzisiejszego dnia!";
      } else {
        // Brak nic istotnego - pomijamy (nie spamuj user'a kazdym dniem)
        continue;
      }

      // Call send-push function
      try {
        const pushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") ?? `Bearer ${serviceRoleKey}`,
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
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
