// =====================================================================
// monitor-user-threshold — Edge Function
// =====================================================================
// Codziennie sprawdza ile mamy zarejestrowanych użytkowników (profiles).
// Gdy przekroczy próg 800 / 950 / 1000 — wysyła email do nat.maz98@gmail.com
// przez Resend i zapisuje wiersz w cache_threshold_alerts (żeby nie spamować).
//
// Cron: codziennie o 09:00 Europe/Warsaw (07:00 UTC), via pg_cron + pg_net.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALERT_EMAIL = "nat.maz98@gmail.com";
const THRESHOLDS = [
  { value: 800, severity: "heads_up", label: "Heads up" },
  { value: 950, severity: "warning", label: "Uwaga" },
  { value: 1000, severity: "alarm", label: "ALARM" },
] as const;

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

async function sendEmail(args: {
  resendKey: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${args.resendKey}`,
      "Content-Type": "application/json",
    },
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

function emailBody(args: {
  threshold: number;
  label: string;
  userCount: number;
  severity: string;
}): { subject: string; html: string } {
  const { threshold, label, userCount, severity } = args;
  const pct = Math.round((userCount / 1001) * 100);

  const subjectMap: Record<string, string> = {
    heads_up: `Trasa: zbliżamy się do limitu cache zdjec (${userCount}/1001)`,
    warning: `Trasa: UWAGA - ${userCount}/1001 uzytkownikow, zaplanuj ewakuacje`,
    alarm: `Trasa: ALARM - ${userCount}/1001 uzytkownikow, wylacz cache w ciagu tygodnia`,
  };

  const actionMap: Record<string, string> = {
    heads_up:
      "Nic do zrobienia teraz. Zacznij myslec o Planie B - push biznesy do uploadu wlasnych zdjec.",
    warning:
      "Wybierz zrodlo zastepcze (Wikimedia / Unsplash / biznes uploads). Przygotuj migracje.",
    alarm:
      "Wylacz cache zdjec klikajac feature flag (PHOTO_CACHE_ENABLED=false w Supabase Dashboard -> Edge Functions -> Secrets). Cache wraca do /api/place-photo.",
  };

  return {
    subject: subjectMap[severity] ?? `Trasa: prog ${threshold} przekroczony`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: ${severity === "alarm" ? "#dc2626" : severity === "warning" ? "#f59e0b" : "#0e0e0e"};">
          ${label}: prog ${threshold} przekroczony
        </h2>
        <p style="font-size: 18px;">
          <strong>${userCount}/1001 uzytkownikow</strong> (${pct}%)
        </p>
        <h3>Co teraz zrobic:</h3>
        <p>${actionMap[severity]}</p>
        <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e5e5e5;" />
        <p style="font-size: 13px; color: #666;">
          Czas alarmu: ${new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}<br/>
          Limit ewakuacji: 1001 uzytkownikow (po przekroczeniu = wylacz cache).
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">
          To powiadomienie wysylane jest tylko raz na prog (po pierwszym przekroczeniu).
          Codzienny cron sprawdza stan o 9:00 Europe/Warsaw.
        </p>
      </div>
    `,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Guard: cron (x-trigger-secret z Vault, jak send-push/push-scheduler) LUB service_role.
  // verify_jwt=false -> sprawdzamy sami. Sam service_role nie wystarcza: klucz bywa rotowany i
  // nie zawsze zgadza sie z env funkcji, a cron budowal naglowek z pustego ustawienia bazy
  // (`app.settings.service_role_key`) -> lecialo "Bearer null" i 401 (naprawione 2026-09-01).
  const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
  const isTrigger = triggerSecret.length > 0 && req.headers.get("x-trigger-secret") === triggerSecret;
  const _auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isTrigger && _auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return jsonResponse({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!resendKey) {
    return jsonResponse({ error: "RESEND_API_KEY not set" }, 500);
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Policz użytkowników w `profiles`
    const { count, error: countError } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return jsonResponse({ error: "Count query failed", details: countError.message }, 500);
    }

    const userCount = count ?? 0;

    // 2. Wczytaj historię alertów
    const { data: alerts } = await sb.from("cache_threshold_alerts").select("threshold");
    const triggered = new Set((alerts ?? []).map((a: { threshold: number }) => a.threshold));

    // 3. Dla każdego progu — wyślij email jeśli przekroczony i jeszcze nie wysłany
    const sent: number[] = [];
    for (const t of THRESHOLDS) {
      if (userCount >= t.value && !triggered.has(t.value)) {
        const { subject, html } = emailBody({
          threshold: t.value,
          label: t.label,
          userCount,
          severity: t.severity,
        });
        try {
          await sendEmail({ resendKey, subject, html });
          await sb.from("cache_threshold_alerts").insert({
            threshold: t.value,
            user_count_at_trigger: userCount,
          });
          sent.push(t.value);
        } catch (err) {
          console.error(`[monitor] Failed to send alert for ${t.value}:`, err);
        }
      }
    }

    return jsonResponse({
      ok: true,
      user_count: userCount,
      thresholds_triggered: sent,
      thresholds_already_done: Array.from(triggered),
    });
  } catch (err) {
    console.error("[monitor-user-threshold] error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
