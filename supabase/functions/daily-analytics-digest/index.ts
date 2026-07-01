// =====================================================================
// daily-analytics-digest — Edge Function
// =====================================================================
// Codziennie wysyła jeden zbiorczy raport na nat.maz98@gmail.com:
//   - Konta: nowe (24h) + łącznie (Supabase = źródło prawdy)
//   - Trasy: nowe (24h, w tym ukończone) + łącznie + aktywacja (% userów z ≥1 trasą)
//   - Zaangażowanie/retencja: DAU / WAU / MAU (PostHog, distinct person_id)
//   - Top eventy (24h) z PostHoga
//
// Źródła: Supabase (konta/trasy) + PostHog (eventy/aktywni). Wysyłka: Resend.
// Cron: codziennie 07:00 UTC (~9:00 Europe/Warsaw) via pg_cron + pg_net.
// Wzorce: monitor-user-threshold (Resend) + admin-analytics (HogQL).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALERT_EMAIL = "nat.maz98@gmail.com";
const POSTHOG_HOST = "https://eu.posthog.com";
const PRIVATE_KEY = Deno.env.get("POSTHOG_PRIVATE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── PostHog HogQL (wzorzec z admin-analytics) ──
async function phQuery(query: string): Promise<any> {
  try {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PRIVATE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });
    if (!res.ok) { console.error("PostHog query error:", await res.text().catch(() => "")); return null; }
    return await res.json();
  } catch (e) {
    console.error("PostHog query exception:", String(e));
    return null;
  }
}
async function phScalar(query: string): Promise<number> {
  const r = await phQuery(query);
  return Number(r?.results?.[0]?.[0] ?? 0);
}
async function phRows(query: string): Promise<any[][]> {
  const r = await phQuery(query);
  return (r?.results ?? []) as any[][];
}

// ── Resend (wzorzec z monitor-user-threshold) ──
async function sendEmail(args: { resendKey: string; subject: string; html: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Trasa <noreply@trasa.travel>",
      to: [ALERT_EMAIL],
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error: ${res.status} ${text}`);
  }
}

// Liczba z Supabase (count exact, head - bez pobierania wierszy).
async function countRows(sb: any, table: string, build?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) { console.error(`count ${table} error:`, error.message); return 0; }
  return count ?? 0;
}

function fmtDelta(now: number, prev: number): string {
  if (prev <= 0) return "";
  const pct = Math.round(((now - prev) / prev) * 100);
  const sign = pct > 0 ? "+" : "";
  const color = pct >= 0 ? "#16a34a" : "#dc2626";
  return ` <span style="color:${color};font-size:12px;font-weight:600;">${sign}${pct}%</span>`;
}

const EVENT_PL: Record<string, string> = {
  user_signed_up: "Rejestracja",
  route_created: "Stworzona trasa",
  group_session_created: "Sesja grupowa",
  landing_waitlist_signup: "Zapis na waitlistę",
  demo_started: "Demo start",
  demo_signup_clicked: "Demo → rejestracja",
  place_viewed: "Podgląd miejsca",
  place_added_to_route: "Dodanie do trasy",
  $pageview: "Otwarcie strony",
  $screen: "Ekran (natywka)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY not set" }, 500);

  const sb = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = Date.now();
    const since24 = new Date(now - 86_400_000).toISOString();
    const sincePrev = new Date(now - 2 * 86_400_000).toISOString();

    // ── Supabase: konta ──
    const [totalAccounts, newAccounts, newAccountsPrev] = await Promise.all([
      countRows(sb, "profiles"),
      countRows(sb, "profiles", (q) => q.gte("created_at", since24)),
      countRows(sb, "profiles", (q) => q.gte("created_at", sincePrev).lt("created_at", since24)),
    ]);

    // ── Supabase: trasy ──
    const [totalRoutes, newRoutes, newRoutesPrev, newCompleted] = await Promise.all([
      countRows(sb, "routes"),
      countRows(sb, "routes", (q) => q.gte("created_at", since24)),
      countRows(sb, "routes", (q) => q.gte("created_at", sincePrev).lt("created_at", since24)),
      countRows(sb, "routes", (q) => q.gte("created_at", since24).eq("trip_type", "completed")),
    ]);

    // ── Aktywacja: % userów z ≥1 trasą (lifetime). Skala MVP (<kilka tys.) -> dedup w JS. ──
    const { data: routeUsers } = await sb.from("routes").select("user_id");
    const activatedSet = new Set((routeUsers ?? []).map((r: any) => r.user_id).filter(Boolean));
    const activationPct = totalAccounts > 0 ? Math.round((activatedSet.size / totalAccounts) * 100) : 0;

    // ── PostHog: DAU/WAU/MAU + top eventy 24h ──
    const [dau, wau, mau, topEvents] = await Promise.all([
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE toDate(timestamp) = today()`),
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE timestamp >= now() - INTERVAL 7 DAY`),
      phScalar(`SELECT count(DISTINCT person_id) AS c FROM events WHERE timestamp >= now() - INTERVAL 30 DAY`),
      phRows(`SELECT event, count() AS c FROM events WHERE timestamp >= now() - INTERVAL 1 DAY GROUP BY event ORDER BY c DESC LIMIT 10`),
    ]);

    const dateLabel = new Date(now).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "Europe/Warsaw" });
    const subject = `Trasa - raport ${dateLabel}: +${newAccounts} kont, +${newRoutes} tras`;

    const ACCENT = "#F9662B";
    const card = (label: string, value: string, sub = "") => `
      <td style="padding:14px 16px;background:#fafafa;border:1px solid #eee;border-radius:14px;vertical-align:top;">
        <div style="font-size:12px;color:#979797;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">${label}</div>
        <div style="font-size:24px;font-weight:800;color:#0E0E0E;margin-top:2px;">${value}</div>
        ${sub ? `<div style="font-size:12px;color:#979797;margin-top:2px;">${sub}</div>` : ""}
      </td>`;

    const eventsRows = (topEvents ?? [])
      .map((row, i) => {
        const ev = String(row[0]);
        const c = Number(row[1] ?? 0);
        const label = EVENT_PL[ev] ?? ev;
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#979797;font-size:13px;width:28px;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#0E0E0E;">${label} <span style="color:#cfcfcf;font-size:12px;">${ev}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;text-align:right;">${c}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#FEFEFE;padding:8px;">
        <h1 style="font-size:20px;color:${ACCENT};margin:8px 4px 2px;">Trasa - dzienny raport</h1>
        <p style="font-size:13px;color:#979797;margin:0 4px 16px;">Dane z ostatnich 24h. Wygenerowano ${new Date(now).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} (Europe/Warsaw).</p>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Konta</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Nowe konta (24h)", `+${newAccounts}${fmtDelta(newAccounts, newAccountsPrev)}`)}
          ${card("Łącznie kont", String(totalAccounts))}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Trasy</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Nowe trasy (24h)", `+${newRoutes}${fmtDelta(newRoutes, newRoutesPrev)}`, `w tym ${newCompleted} ukończonych`)}
          ${card("Łącznie tras", String(totalRoutes))}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Aktywacja i retencja</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Aktywacja", `${activationPct}%`, `${activatedSet.size}/${totalAccounts} z ≥1 trasą`)}
          ${card("DAU", String(dau), "aktywni dziś")}
        </tr><tr style="height:8px;"></tr><tr>
          ${card("WAU", String(wau), "aktywni 7 dni")}
          ${card("MAU", String(mau), "aktywni 30 dni")}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Top eventy (24h)</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          ${eventsRows || `<tr><td style="padding:12px;color:#979797;font-size:13px;">Brak eventów w tym oknie.</td></tr>`}
        </table>

        <p style="font-size:11px;color:#cfcfcf;margin:24px 4px 8px;">Konta i trasy: Supabase (źródło prawdy). DAU/WAU/MAU i eventy: PostHog. Raport automatyczny, codziennie ~9:00.</p>
      </div>`;

    await sendEmail({ resendKey, subject, html });

    return jsonResponse({
      sent: true,
      to: ALERT_EMAIL,
      summary: { newAccounts, totalAccounts, newRoutes, totalRoutes, newCompleted, activationPct, dau, wau, mau, topEvents: (topEvents ?? []).length },
    });
  } catch (err) {
    console.error("[daily-analytics-digest] failed:", String(err));
    return jsonResponse({ error: String(err) }, 500);
  }
});
