const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["nat.maz98@gmail.com", "tomalab97@gmail.com"];

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    const rawEmail: string | undefined = body.email ?? body.record?.email;
    const createdAt: string | undefined = body.created_at ?? body.record?.created_at;
    const count: number | undefined = body.count;

    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const whenPL = createdAt
      ? new Date(createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })
      : new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "spontaway <noreply@spontaway.com>",
        to: ADMIN_EMAILS,
        subject: `🎉 Nowy zapis na waitlistę: ${email}`,
        html: `
          <h2 style="margin:0 0 12px;">Nowy user na waitliście!</h2>
          <p style="margin:8px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin:8px 0;"><strong>Czas:</strong> ${escapeHtml(whenPL)}</p>
          ${count !== undefined ? `<p style="margin:8px 0;"><strong>Łącznie zapisanych:</strong> ${count}</p>` : ""}
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;">
          <p style="margin:8px 0;font-size:12px;color:#666;">
            Sprawdź listę: <a href="https://admin.spontaway.com">admin.spontaway.com</a>
          </p>
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
    console.error("[notify-waitlist-signup]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
