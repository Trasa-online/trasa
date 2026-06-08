// Admin-only product analytics from PostHog (HogQL). Gated by user_roles role='admin'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POSTHOG_HOST = "https://eu.posthog.com";
const PRIVATE_KEY = Deno.env.get("POSTHOG_PRIVATE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // ── Auth: tylko admin (user_roles role='admin') ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden - admin only" }, 403);

    // ── Parametry ──
    const { range_days = 30 } = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(range_days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const prevSince = new Date(Date.now() - days * 2 * 86_400_000).toISOString().slice(0, 10);

    const cnt = (event: string, from: string, to?: string) =>
      `SELECT count() AS c FROM events WHERE event = '${event}' AND toDate(timestamp) >= '${from}'${to ? ` AND toDate(timestamp) < '${to}'` : ""}`;

    const [
      signups, signupsPrev, routes, routesPrev, groups, waitlist,
      dau, wau, mau, daily, funnel,
    ] = await Promise.all([
      phScalar(cnt("user_signed_up", since)),
      phScalar(cnt("user_signed_up", prevSince, since)),
      phScalar(cnt("route_created", since)),
      phScalar(cnt("route_created", prevSince, since)),
      phScalar(cnt("group_session_created", since)),
      phScalar(cnt("landing_waitlist_signup", since)),
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE toDate(timestamp) = today()`),
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE timestamp >= now() - INTERVAL 7 DAY`),
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE timestamp >= now() - INTERVAL 30 DAY`),
      phRows(`SELECT toDate(timestamp) AS day, countIf(event = 'user_signed_up') AS signups, countIf(event = 'route_created') AS routes, count(DISTINCT person_id) AS active FROM events WHERE toDate(timestamp) >= '${since}' GROUP BY day ORDER BY day ASC`),
      Promise.all([
        phScalar(cnt("demo_started", since)),
        phScalar(cnt("demo_signup_clicked", since)),
        phScalar(cnt("user_signed_up", since)),
        phScalar(cnt("route_created", since)),
      ]),
    ]);

    const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);

    return json({
      rangeDays: days,
      kpis: {
        signups: { value: signups, deltaPct: pct(signups, signupsPrev) },
        routes: { value: routes, deltaPct: pct(routes, routesPrev) },
        groups: { value: groups, deltaPct: null },
        waitlist: { value: waitlist, deltaPct: null },
        dau, wau, mau,
      },
      daily: (daily ?? []).map((r: any[]) => ({ date: r[0], signups: r[1], routes: r[2], active: r[3] })),
      funnel: [
        { step: "Demo start", value: funnel[0] },
        { step: "Demo → rejestracja klik", value: funnel[1] },
        { step: "Rejestracja", value: funnel[2] },
        { step: "Stworzona trasa", value: funnel[3] },
      ],
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

async function phQuery(query: string) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PRIVATE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) { console.error("PostHog query error:", await res.text()); return null; }
  return res.json();
}
async function phScalar(query: string): Promise<number> {
  const r = await phQuery(query);
  return r?.results?.[0]?.[0] ?? 0;
}
async function phRows(query: string): Promise<any[]> {
  const r = await phQuery(query);
  return r?.results ?? [];
}
