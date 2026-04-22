const POSTHOG_HOST = "https://eu.posthog.com";
const PRIVATE_KEY = Deno.env.get("POSTHOG_PRIVATE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENT_LABEL: Record<string, string> = {
  place_viewed: "view",
  place_added_to_route: "add_to_route",
  place_website_clicked: "click_website",
  place_phone_clicked: "click_phone",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, range_days = 30, include_recent = false } = await req.json();
    if (!place_id) return new Response(JSON.stringify({ error: "place_id required" }), { status: 400 });

    const since = new Date(Date.now() - range_days * 86_400_000).toISOString().slice(0, 10);

    const queries: Promise<any>[] = [
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_viewed' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_added_to_route' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_website_clicked' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_phone_clicked' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT toDate(timestamp) AS day, countIf(event = 'place_viewed') AS views, countIf(event = 'place_added_to_route') AS routes, countIf(event = 'place_website_clicked' OR event = 'place_phone_clicked') AS clicks FROM events WHERE properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}' GROUP BY day ORDER BY day ASC`),
    ];

    if (include_recent) {
      queries.push(
        phQuery(`SELECT event, timestamp FROM events WHERE properties.place_id = '${place_id}' AND event IN ('place_viewed','place_added_to_route','place_website_clicked','place_phone_clicked') ORDER BY timestamp DESC LIMIT 8`)
      );
    }

    const results = await Promise.all(queries);
    const [viewsRes, routesRes, clicksWebRes, clicksPhoneRes, dailyRes, recentRes] = results;

    const views = viewsRes?.results?.[0]?.[0] ?? 0;
    const onRoutes = routesRes?.results?.[0]?.[0] ?? 0;
    const websiteClicks = clicksWebRes?.results?.[0]?.[0] ?? 0;
    const phoneClicks = clicksPhoneRes?.results?.[0]?.[0] ?? 0;

    const chartData = (dailyRes?.results ?? []).map((row: any[]) => ({
      date: row[0],
      views: row[1],
      routes: row[2],
      clicks: row[3],
    }));

    const recentEvents = include_recent
      ? (recentRes?.results ?? []).map((row: any[]) => ({
          event_type: EVENT_LABEL[row[0]] ?? row[0],
          created_at: row[1],
        }))
      : undefined;

    return new Response(JSON.stringify({ views, onRoutes, websiteClicks, phoneClicks, chartData, recentEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function phQuery(query: string) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    console.error("PostHog query error:", await res.text());
    return null;
  }
  return res.json();
}
