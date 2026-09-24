import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Wlasny mail resetu hasla dla BIZNESU (niebieski branding B2B). Generujemy token
// serwerowo (admin.generateLink -> hashed_token) i sami skladamy link token-hash:
//   https://spontaway.com/?bizreset=1&token_hash=<hashed_token>&type=recovery
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

// ── SKÓRA MAILI B2B (2026-09-15) ────────────────────────────────────────────────────────
// Branding maili dla lokali zszedl z niebieskiego razem z panelem i ekranem logowania
// (decyzja Nat 2026-09-14). Wczesniej: niebieski pasek u gory, niebieska orba i niebieski
// guzik - identyfikacja, ktorej nie ma juz nigdzie indziej w produkcie.
//
// Teraz uklad jest ten sam, co na `/auth?business=true`: biala belka ze znakiem i wordmarkiem
// "spontaway biznes", pod nia ZOLTE hero `#FDF184` z naglowkiem w brazie `#5B2C06`, nizej
// pomaranczowe CTA `#EE5307` w pigulce.
//
// ⛔ Sigmar (font marki) NIE dziala w mailu - Gmail i Outlook wycinaja @font-face. Naglowki
//    ida ciezkim stosem systemowym; charakter niesie kolor i uklad, nie krój.
// ⛔ Kolorow nie wpisujemy inline "na oko": pomarańcz na żółtym ma kontrast 3,08:1, wiec na
//    zoltym tle piszemy WYLACZNIE brazem (10:1). Pomaranczowy zostaje na guzik i znak.
// ⛔ Te same trzy maile trzymamy w JEDNYM stylu - zmieniasz tu, zmien tez w
//    `send-business-welcome/welcome.ts` i `send-business-password-reset/index.ts`.
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MARK = "https://spontaway.com/spontaway-symbol.png";

export function bizEmailShell({ title, heading, lead, ctaUrl, ctaLabel, after, footer }: {
  title: string; heading: string; lead: string; ctaUrl: string; ctaLabel: string; after: string; footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:${FONT};color:#5B2C06;-webkit-font-smoothing:antialiased;">
  <!-- Belka marki - ta sama, co nad formularzem rejestracji lokalu -->
  <div style="background:#FEFEFE;padding:22px 24px 18px;text-align:center;border-bottom:1px solid #F0E6D2;">
    <img src="${MARK}" alt="" width="26" height="26" style="display:inline-block;width:26px;height:26px;vertical-align:middle;border:0;" />
    <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#5B2C06;">spontaway <span style="color:#EE5307;">biznes</span></span>
  </div>

  <!-- Hero: zolte tlo marki, naglowek i lead w brazie -->
  <div style="background:#FDF184;padding:40px 28px 36px;text-align:center;">
    <div style="max-width:480px;margin:0 auto;">
      <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 14px;color:#5B2C06;line-height:1.2;">${heading}</h1>
      <p style="font-size:16px;line-height:1.6;color:#6B3A0F;margin:0;">${lead}</p>
    </div>
  </div>

  <!-- Akcja -->
  <div style="max-width:480px;margin:0 auto;padding:32px 32px 44px;text-align:center;">
    <a href="${ctaUrl}" style="display:inline-block;background-color:#EE5307;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:15px 34px;border-radius:999px;">${ctaLabel}</a>
    <p style="font-size:13px;color:#8A7A6B;margin:32px 0 0;line-height:1.6;">${after}</p>
    <p style="font-size:13px;color:#8A7A6B;margin:22px 0 0;">
      <strong style="color:#5B2C06;">Zespół spontaway</strong>
    </p>
    <div style="margin-top:40px;padding-top:22px;border-top:1px solid #F0E6D2;">
      <p style="font-size:11px;color:#A0907F;margin:0;line-height:1.5;">
        ${footer}<br/>
        Kontakt: <a href="mailto:hello@spontaway.com" style="color:#EE5307;text-decoration:none;">hello@spontaway.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildHtml(link: string): string {
  return bizEmailShell({
    title: "Zmiana hasła do panelu spontaway biznes",
    heading: "Zmiana hasła",
    lead: "Dostaliśmy prośbę o&#160;zmianę hasła do&#160;Twojego konta biznesowego. Kliknij poniżej, żeby ustawić nowe. Link jest ważny przez&#160;60&#160;minut.",
    ctaUrl: link,
    ctaLabel: "Ustaw nowe hasło →",
    after: "Nie&#160;prosiłeś o&#160;reset? Zignoruj tego maila - hasło zostanie bez&#160;zmian. Nie&#160;udostępniaj tego linku nikomu.",
    footer: `Dostałeś tego maila, ponieważ ktoś poprosił o&#160;reset hasła do&#160;konta biznesowego na&#160;<a href="https://spontaway.com" style="color:#EE5307;text-decoration:none;">spontaway.com</a>.`,
  });
}


// ⚠️ TRWALY limit w BAZIE obok pamieciowego (audyt naduzyc 2026-09-24). Pamiec funkcji
// brzegowej zyje tylko w jednej instancji, a Deno Deploy trzyma ich wiele naraz i podnosi
// nowe pod obciazeniem - czyli dokladnie wtedy, gdy limit jest potrzebny. Licznik w bazie
// jest wspolny dla wszystkich instancji. Fail-open: blad bazy nie moze zablokowac rejestracji.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(ip) || await dbRateLimited(`bizreset:ip:${ip}`, 10, 60) || await dbRateLimited("bizreset:all", 200, 60)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email: rawEmail } = await req.json();
    if (!rawEmail || typeof rawEmail !== "string") throw new Error("email required");
    const email = rawEmail.trim().slice(0, 254);
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Trwaly throttle (per IP i per email) - blokuje reset-bombing ofiary.
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [ipHit, emailHit] = await Promise.all([
        supabase.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `rst:ip:${ip}`).gte("created_at", since),
        supabase.from("fn_throttle").select("id", { count: "exact", head: true }).eq("bucket", `rst:email:${email}`).gte("created_at", since),
      ]);
      if ((ipHit.count ?? 0) >= 10 || (emailHit.count ?? 0) >= 3) {
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("fn_throttle").insert([{ bucket: `rst:ip:${ip}` }, { bucket: `rst:email:${email}` }]);
    } catch (_e) { /* fn_throttle moze nie istniec - polegamy na in-memory */ }

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
    const link = `https://spontaway.com/#/set-password-biznes?bizreset=1&token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "spontaway biznes <hello@spontaway.com>",
        to: [email],
        subject: "Zmiana hasła - spontaway biznes",
        html: buildHtml(link),
        text: `Zmiana hasła do konta biznesowego spontaway. Ustaw nowe hasło (link ważny 60 min): ${link}`,
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
