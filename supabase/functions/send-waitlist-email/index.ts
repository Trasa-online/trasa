import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWaitlistWelcomeHtml, waitlistSubject, type MailLang } from "./welcome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

const ipHits = new Map<string, number[]>();
function rateLimited(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { ipHits.set(ip, arr); return true; }
  arr.push(now); ipHits.set(ip, arr);
  return false;
}


// ⚠️ TRWALY limit w BAZIE obok pamieciowego (audyt 2026-09-24). Ta funkcja wysyla maila na
// DOWOLNY podany adres, a limit w pamieci instancji praktycznie znika pod obciazeniem (Deno
// Deploy podnosi kolejne instancje). Bez tego mamy gotowe narzedzie do bombardowania cudzej
// skrzynki z NASZEJ domeny - czyli takze do spalenia reputacji nadawcy w Resend.
// Fail-open: awaria licznika nie moze zablokowac zapisow na waitliste.
async function dbRateLimited(bucket: string, limit: number, windowMinutes: number): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !key) return false;
    const res = await fetch(`${url}/rest/v1/rpc/try_consume_rate_limit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_bucket: bucket, p_limit: limit, p_window_minutes: windowMinutes }),
    });
    if (!res.ok) return false;
    return (await res.json()) === false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(ip) || await dbRateLimited(`wl:ip:${ip}`, 15, 60) || await dbRateLimited("wl:all", 200, 60)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email: rawEmail, lang: rawLang } = await req.json();
    // Jezyk landingu w momencie zapisu. Nieznany -> polski (jak wszedzie indziej).
    const lang: MailLang = rawLang === "en" ? "en" : "pl";
    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");
    // Na JEDEN adres najwyzej 3 maile na godzine - to jest wlasciwa obrona przed bombardowaniem
    // konkretnej skrzynki (limit na IP obchodzi sie zmiana sieci, limit na adres nie).
    if (await dbRateLimited(`wl:mail:${email}`, 3, 60)) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trwaly throttle (per IP i per email) - blokuje mail-bombing z zaufanej domeny.
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [ipHit, emailHit] = await Promise.all([
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `wl:ip:${ip}`).gte("created_at", since),
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `wl:email:${email}`).gte("created_at", since),
      ]);
      if ((ipHit.count ?? 0) >= 15 || (emailHit.count ?? 0) >= 3) {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("fn_throttle").insert([{ bucket: `wl:ip:${ip}` }, { bucket: `wl:email:${email}` }]);
    } catch (_e) { /* fn_throttle moze nie istniec - polegamy na in-memory */ }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "spontaway <hello@spontaway.com>",
        to: [email],
        subject: waitlistSubject(lang),
        html: buildWaitlistWelcomeHtml(lang),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-waitlist-email]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
