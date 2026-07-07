import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ScheduleWindow = "morning" | "evening";

// Push scheduler odpalany przez pg_cron 2x dziennie:
// - morning (cron 7:00 UTC = 9:00 PL latem): review yesterday + active today
// - evening (cron 17:00 UTC = 19:00 PL latem): trip preview tomorrow
//
// Body przykład: { "window": "morning" } lub { "window": "evening" }
// Bez parametru = legacy behavior (wszystkie 3 typy w kolejnosci priorytetu).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Guard: tylko service_role (cron). verify_jwt=false -> sprawdzamy sami, inaczej
  // ktokolwiek moglby odpalic broadcast push do userow.
  const _auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (_auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse window param z body (default = bez filtra = legacy)
    let windowParam: ScheduleWindow | null = null;
    try {
      const body = await req.json();
      if (body?.window === "morning" || body?.window === "evening") {
        windowParam = body.window;
      }
    } catch {
      // Brak body / niepoprawny JSON = legacy mode
    }

    console.log(`[push-scheduler] window=${windowParam ?? "legacy"}`);

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

    let totalSent = 0;
    let totalFailed = 0;

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    for (const userId of uniqueUserIds) {
      let title = "";
      let body = "";
      let url = "/home";

      // Morning window: review yesterday (jesli nie ma jeszcze recenzji) lub active today
      // Evening window: trip preview tomorrow
      // Legacy (windowParam null): priorytet tomorrow > yesterday > today
      const wantTomorrow = windowParam === "evening" || windowParam === null;
      const wantYesterday = windowParam === "morning" || windowParam === null;
      const wantToday = windowParam === "morning" || windowParam === null;

      let route: { id: string; title?: string; city?: string; review_photos?: unknown[] } | null = null;
      let kind: "tomorrow" | "yesterday" | "today" | "active" | null = null;

      if (wantTomorrow) {
        const { data } = await supabase
          .from("routes")
          .select("id, title, city")
          .eq("user_id", userId)
          .eq("status", "published")
          .eq("start_date", tomorrow)
          .limit(1);
        if (data && data.length > 0) {
          route = data[0] as typeof route;
          kind = "tomorrow";
        }
      }

      if (!route && wantYesterday) {
        const { data } = await supabase
          .from("routes")
          .select("id, title, city, review_photos")
          .eq("user_id", userId)
          .eq("status", "published")
          .eq("start_date", yesterday)
          .limit(1);
        if (data && data.length > 0) {
          const r = data[0] as typeof route;
          const hasReview = Array.isArray(r?.review_photos) && r.review_photos.length > 0;
          if (!hasReview) {
            route = r;
            kind = "yesterday";
          }
        }
      }

      if (!route && wantToday) {
        const { data } = await supabase
          .from("routes")
          .select("id, title, city")
          .eq("user_id", userId)
          .eq("status", "published")
          .eq("start_date", today)
          .limit(1);
        if (data && data.length > 0) {
          route = data[0] as typeof route;
          kind = "today";
        }
      }

      // Legacy fallback - active trip folder bez konkretnej daty
      if (!route && windowParam === null) {
        const { data: activeTrips } = await supabase
          .from("route_folders")
          .select("id, name")
          .eq("user_id", userId)
          .eq("is_trip", true)
          .limit(1);
        if (activeTrips && activeTrips.length > 0) {
          title = `Twoja podróż: ${activeTrips[0].name}`;
          body = "Zapisz wspomnienia z dzisiejszego dnia";
          kind = "active";
        }
      }

      if (!kind) {
        // Brak nic istotnego dla tego usera w tym oknie - pomijamy
        continue;
      }

      if (route) {
        const cityName = route.city ?? "trasy";
        if (kind === "tomorrow") {
          title = `Jutro: ${cityName}`;
          body = `Twoja trasa po ${cityName} startuje jutro. Sprawdź plan`;
          url = `/day-review?route=${route.id}`;
        } else if (kind === "yesterday") {
          title = `Jak wczoraj w ${cityName}?`;
          body = "Dodaj recenzje i zdjęcia do dziennika";
          url = `/review-summary?route=${route.id}`;
        } else if (kind === "today") {
          title = `Dziś trasa po ${cityName}`;
          body = "Twój plan jest gotowy - powodzenia";
          url = `/day/${route.id}`;
        }
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

    console.log(`[push-scheduler] window=${windowParam ?? "legacy"} done: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        message: "Push scheduler completed",
        window: windowParam ?? "legacy",
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
