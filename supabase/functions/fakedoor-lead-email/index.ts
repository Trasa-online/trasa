import { joinHtml, routeHtml, type RoutePayload } from "./emails.ts";

// Maile potwierdzajace zapis z fake doora (web, trasatravel.com).
//   variant "create_route"          -> mail A (podziekowanie za zapis)
//   variant "save_route"/"get_route" -> mail B (podsumowanie trasy + podziekowanie)
// Wywolywane z klienta po insercie leada do fakedoor_leads.

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

    const body = await req.json();
    const email = String(body?.email ?? "").trim().slice(0, 254);
    const variant = String(body?.variant ?? "");
    const route = (body?.route ?? null) as RoutePayload | null;

    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    let subject: string;
    let html: string;
    if (variant === "save_route" || variant === "get_route") {
      if (!route?.title) throw new Error("route payload required");
      subject = `Twoja trasa: ${route.title}`;
      html = routeHtml(route);
    } else {
      subject = "Dzięki, że jesteś z Trasą!";
      html = joinHtml();
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <hello@trasa.travel>",
        to: [email],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fakedoor-lead-email]", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
