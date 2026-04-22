const POSTHOG_HOST = "https://eu.posthog.com";
const PRIVATE_KEY = Deno.env.get("POSTHOG_PRIVATE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, range_days = 30 } = await req.json();
    if (!place_id) return new Response(JSON.stringify({ error: "place_id required" }), { status: 400 });

    const since = new Date(Date.now() - range_days * 86_400_000).toISOString().slice(0, 10);

    // Run all queries in parallel
    const [viewsRes, routesRes, clicksWebRes, clicksPhoneRes, dailyRes] = await Promise.all([
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_viewed' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_added_to_route' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_website_clicked' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT count() AS c FROM events WHERE event = 'place_phone_clicked' AND properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}'`),
      phQuery(`SELECT toDate(timestamp) AS day, countIf(event = 'place_viewed') AS views, countIf(event = 'place_added_to_route') AS routes, countIf(event = 'place_website_clicked' OR event = 'place_phone_clicked') AS clicks FROM events WHERE properties.place_id = '${place_id}' AND toDate(timestamp) >= '${since}' GROUP BY day ORDER BY day ASC`),
    ]);

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

    return new Response(JSON.stringify({ views, onRoutes, websiteClicks, phoneClicks, chartData }), {
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
