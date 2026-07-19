import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Wlasny mail resetu hasla dla BIZNESU (niebieski branding B2B). Generujemy token
// serwerowo (admin.generateLink -> hashed_token) i sami skladamy link token-hash:
//   https://trasa.travel/?bizreset=1&token_hash=<hashed_token>&type=recovery
// Klient robi verifyOtp(token_hash, recovery) - NIE wymaga PKCE code_verifiera, wiec
// dziala niezaleznie od tego czy link otworzy sie w apce czy w Safari. Zero zaleznosci
// od wbudowanego szablonu Supabase / allowlisty / flowType.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

const ipHits = new Map<string, number[]>();
function rateLimited(ip: string, max = 6, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { ipHits.set(ip, arr); return true; }
  arr.push(now); ipHits.set(ip, arr);
  return false;
}

function buildHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="light"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0E0E0E;">
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <img src="https://trasa.travel/icon-192.png" alt="Trasa" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:50%;margin:0 auto 20px;" />
    <p style="font-size:13px;font-weight:800;letter-spacing:0.04em;color:#2563EB;margin:0 0 20px;">TRASA BIZNES</p>
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;line-height:1.25;">Zmiana hasła</h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">Dostaliśmy prośbę o&#160;zmianę hasła do&#160;Twojego konta biznesowego.</p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">Kliknij poniżej, żeby ustawić nowe hasło. Link jest ważny przez 60&#160;minut.</p>
    <a href="${link}" style="display:inline-block;background-color:#2563EB;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;margin:0 0 32px;">Ustaw nowe hasło →</a>
    <div style="background:#EFF6FF;border:1px solid #DBEAFE;border-radius:16px;padding:16px 20px;text-align:left;margin:0 0 32px;">
      <p style="font-size:13px;line-height:1.6;color:#1E40AF;margin:0;"><strong>Nie&#160;prosiłeś o&#160;reset?</strong> Zignoruj tego maila - Twoje hasło zostanie bez&#160;zmian. Nie&#160;udostępniaj tego linku nikomu.</p>
    </div>
    <p style="font-size:13px;color:#979797;margin:0 0 8px;">Masz problem? Napisz na&#160;<a href="mailto:hello@trasa.travel" style="color:#2563EB;text-decoration:none;">hello@trasa.travel</a></p>
    <p style="font-size:13px;color:#979797;margin:24px 0 0;"><strong style="color:#0E0E0E;">Zespół Trasy</strong></p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email: rawEmail } = await req.json();
    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Generuj token resetu serwerowo. Jesli konto nie istnieje - NIE zdradzamy tego
    // (zwracamy sukces), zeby nie dalo sie enumerowac adresow.
    const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
    const hashedToken = (data as any)?.properties?.hashed_token;
    if (error || !hashedToken) {
      console.warn("[send-business-password-reset] generateLink:", error?.message ?? "no hashed_token (konto moze nie istniec)");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Link kieruje PROSTO na route /set-password-biznes (w hashu HashRoutera) - wtedy
    // react-router ladinguje od razu na formularzu, ktory wszystkie straze biznesowe
    // omijaja (exempt /set-password), a GlobalAuthCallback bailuje (hash ma set-password-biznes).
    // SetPassword sam robi verifyOtp(token_hash) - bez PKCE verifiera, dziala z Safari.
    const link = `https://trasa.travel/#/set-password-biznes?bizreset=1&token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Trasa Biznes <hello@trasa.travel>",
        to: [email],
        subject: "Zmiana hasła - Trasa Biznes",
        html: buildHtml(link),
        text: `Zmiana hasła do konta biznesowego Trasa. Ustaw nowe hasło (link ważny 60 min): ${link}`,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[send-business-password-reset] Resend error:", res.status, t);
      throw new Error("email send failed");
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[send-business-password-reset] error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
