// Powiadomienie dla nas: lokal z panelu roboczego przechodzi do rejestracji.
//
// [sec] audyt M6 (2026-09-08). Wczesniej ta funkcja wstawiala `business_name` i `profile_id`
// PROSTO w tresc maila, bez zadnego sprawdzenia i bez limitu. Kazdy z kluczem anon (a ten
// siedzi w bundlu apki) mogl wiec wyslac nam na skrzynke dowolny HTML - z linkiem
// phishingowym w naszej wlasnej domenie nadawcy - i powtarzac to bez konca.
//
// Trzy bariery: dlugosc + format wejscia, ucieczka znakow HTML, trwaly limit w bazie.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Limit trwaly (w bazie), nie w pamieci procesu. Licznik w pamieci nic tu nie daje:
 * funkcje brzegowe zyja krotko i chodza w wielu instancjach naraz, wiec kazde zimne
 * uruchomienie zaczyna liczyc od zera.
 * Fail-open, zeby blad bazy nie wyciszyl prawdziwego powiadomienia.
 */
async function withinLimit(req: Request): Promise<boolean> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { data, error } = await sb.rpc("try_consume_rate_limit", {
      p_bucket: `draftconv:${ip}`, p_limit: 5, p_window_minutes: 60,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await withinLimit(req))) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rawName = typeof body.business_name === "string" ? body.business_name.trim().slice(0, 120) : "";
    const rawId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
    // Id profilu ma byc UUID. Cokolwiek innego to nie jest nasz ruch - nie przepisujemy
    // tego do maila, zeby nie zrobic z powiadomienia kanalu na dowolna tresc.
    const profileId = UUID_RE.test(rawId) ? rawId : "(nieprawidlowe id)";
    const name = rawName || "(nie podano)";

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "spontaway <noreply@spontaway.com>",
        to: ["nat.maz98@gmail.com"],
        subject: `Nowy Founding Partner: ${rawName || "lokal bez nazwy"}`,
        html: `
          <h2>Nowy lokal chce dołączyć do spontaway!</h2>
          <p><strong>Nazwa:</strong> ${escapeHtml(name)}</p>
          <p><strong>ID profilu:</strong> ${escapeHtml(profileId)}</p>
          <p><strong>Czas:</strong> ${escapeHtml(new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }))}</p>
          <hr>
          <p>Lokal kliknął "Zakładam konto" w panelu roboczym i przechodzi do rejestracji.</p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend error: ${text}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[notify-draft-conversion]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
