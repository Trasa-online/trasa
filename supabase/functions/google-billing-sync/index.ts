// google-billing-sync - dociaga PRAWDZIWY rachunek Google Cloud z eksportu rozliczen w BigQuery
// do tabeli public.google_billing_daily (panel ops "Koszty API", prosba Nat 2026-09-20).
//
// Dlaczego BigQuery: Google nie ma endpointu "ile wydalem w tym miesiacu" - jedyna droga do
// kwot z uwzglednionym rabatem i darmowa pula (czyli tych z faktury) to standardowy eksport
// kosztow na koncie rozliczeniowym -> tabela gcp_billing_export_v1_* w zbiorze `billing`.
//
// Uwierzytelnienie do Google: konto uslugi (sekret GOOGLE_BILLING_SA_JSON = caly plik JSON klucza,
// role BigQuery Job User + Data Viewer w projekcie GOOGLE_BILLING_PROJECT). JWT RS256 -> token.
//
// Wywolanie: cron (x-trigger-secret z Vault), service_role albo ADMIN z aplikacji (guzik
// "Odswiez teraz" w panelu). Body: { dry_run?: true } = policz i oddaj, nic nie zapisuj.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAYS_BACK = 40; // upsert po kluczu, wiec spoznione korekty Google dojezdzaja same

// ── Token konta uslugi (JWT RS256 -> OAuth2) ────────────────────────────────
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function serviceAccountToken(sa: { client_email: string; private_key: string; token_uri?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`google token: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data.access_token as string;
}

// ── BigQuery ────────────────────────────────────────────────────────────────
async function bqQuery(token: string, project: string, query: string): Promise<Record<string, string | null>[]> {
  const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, useLegacySql: false, timeoutMs: 60_000, maxResults: 10_000 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`bigquery: ${res.status} ${JSON.stringify(data.error ?? data).slice(0, 500)}`);
  if (!data.jobComplete) throw new Error("bigquery: job not complete within timeout");
  const fields: string[] = (data.schema?.fields ?? []).map((f: any) => f.name);
  return (data.rows ?? []).map((r: any) => Object.fromEntries(fields.map((name, i) => [name, r.f[i]?.v ?? null])));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Guard: cron (sekret z Vault) / service_role / admin z aplikacji.
  const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
  const isTrigger = triggerSecret.length > 0 && req.headers.get("x-trigger-secret") === triggerSecret;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = isTrigger || bearer === serviceRoleKey;
  if (!allowed && bearer) {
    const { data: u } = await sb.auth.getUser(bearer);
    if (u?.user?.id) {
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      allowed = isAdmin === true;
    }
  }
  if (!allowed) return json({ error: "unauthorized" }, 401);

  let body: { dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* pusty body z crona */ }

  const saRaw = Deno.env.get("GOOGLE_BILLING_SA_JSON");
  const project = Deno.env.get("GOOGLE_BILLING_PROJECT");
  const dataset = Deno.env.get("GOOGLE_BILLING_DATASET") ?? "billing";
  if (!saRaw || !project) return json({ error: "GOOGLE_BILLING_SA_JSON / GOOGLE_BILLING_PROJECT not set" }, 500);
  let sa: any;
  try { sa = JSON.parse(saRaw); } catch { return json({ error: "GOOGLE_BILLING_SA_JSON is not valid JSON" }, 500); }

  try {
    const token = await serviceAccountToken(sa);

    // Nazwa tabeli eksportu zawiera id konta rozliczeniowego - szukamy jej, zamiast wpisywac
    // na sztywno. Kilka kont = kilka tabel; sumujemy wszystkie.
    const tables = await bqQuery(token, project,
      `SELECT table_name FROM \`${project}.${dataset}.INFORMATION_SCHEMA.TABLES\` WHERE table_name LIKE 'gcp_billing_export_v1_%'`);
    if (!tables.length) return json({ ok: true, rows: 0, note: "no export table yet - Google creates it a few hours after enabling the export" });

    const unions = tables.map((t) => `SELECT * FROM \`${project}.${dataset}.${t.table_name}\``).join(" UNION ALL ");
    // Dzien liczony w czasie polskim, zeby "dzis" w panelu znaczylo to samo, co na fakturze
    // (Google fakturuje w strefie konta). credits.amount jest w eksporcie UJEMNE - oddajemy dodatnie.
    const rows = await bqQuery(token, project, `
      SELECT DATE(usage_start_time, 'Europe/Warsaw') AS day,
             IFNULL(project.id, '') AS project_id,
             service.description AS service,
             sku.description AS sku,
             currency,
             ROUND(SUM(cost), 4) AS cost,
             ROUND(-SUM((SELECT IFNULL(SUM(c.amount), 0) FROM UNNEST(credits) c)), 4) AS credits
      FROM (${unions})
      WHERE usage_start_time >= TIMESTAMP(DATE_SUB(CURRENT_DATE('Europe/Warsaw'), INTERVAL ${DAYS_BACK} DAY), 'Europe/Warsaw')
      GROUP BY 1, 2, 3, 4, 5
      HAVING ABS(cost) > 0 OR ABS(credits) > 0
      ORDER BY 1 DESC`);

    const records = rows.map((r) => ({
      day: r.day, project_id: r.project_id ?? "", service: r.service ?? "", sku: r.sku ?? "",
      currency: r.currency ?? "PLN", cost: Number(r.cost ?? 0), credits: Number(r.credits ?? 0),
      synced_at: new Date().toISOString(),
    }));
    if (body.dry_run) return json({ ok: true, dry_run: true, tables: tables.map((t) => t.table_name), rows: records.length, sample: records.slice(0, 20) });

    if (records.length) {
      const { error } = await sb.from("google_billing_daily").upsert(records, { onConflict: "day,project_id,service,sku" });
      if (error) throw new Error(`upsert: ${error.message}`);
    }
    return json({ ok: true, tables: tables.map((t) => t.table_name), rows: records.length });
  } catch (e) {
    console.error("[google-billing-sync]", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
