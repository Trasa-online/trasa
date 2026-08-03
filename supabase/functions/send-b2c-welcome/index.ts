import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildB2cWelcomeHtml, buildB2cWelcomeText } from "./welcome.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email: rawEmail, first_name } = await req.json();
    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");

    // Trwaly throttle (per IP i per email) - anty mail-bombing.
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [ipHit, emailHit] = await Promise.all([
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `wc:ip:${ip}`).gte("created_at", since),
        admin.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `wc:email:${email}`).gte("created_at", since),
      ]);
      if ((ipHit.count ?? 0) >= 15 || (emailHit.count ?? 0) >= 3) {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("fn_throttle").insert([{ bucket: `wc:ip:${ip}` }, { bucket: `wc:email:${email}` }]);
    } catch (_e) { /* fn_throttle moze nie istniec */ }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const safeFirstName = (first_name ?? "").toString().slice(0, 80);
    const appUrl = "https://trasa.travel/#/home";
    const html = buildB2cWelcomeHtml({ firstName: safeFirstName, appUrl });
    const text = buildB2cWelcomeText({ firstName: safeFirstName, appUrl });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <hello@trasa.travel>",
        to: [email],
        subject: safeFirstName ? `Cześć, ${safeFirstName}! Witamy w Trasie` : "Witamy Cię w Trasie",
        html,
        text,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-b2c-welcome]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
