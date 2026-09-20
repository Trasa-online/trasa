// Zapytanie o oferte od lokalu (guzik „Skontaktuj sie" na landingu B2C).
//
// Dlaczego funkcja, a nie insert z klienta: tabela `business_inquiries` nie ma polityki
// INSERT dla anon - formularz stoi na otwartej stronie, wiec walidacja i limit czestotliwosci
// musza byc po stronie serwera. Funkcja chodzi jako service_role, ktore RLS pomija.
//
// Poza zapisem wysyla mail do zalozycieli - zapytanie ofertowe traci wartosc, jesli ktos
// zajrzy do panelu za tydzien. Blad wysylki NIE cofa zapisu (lead jest wazniejszy niz mail).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

/** Przycina i czysci pole tekstowe; puste -> null, zeby w bazie nie siedzialy puste stringi. */
function field(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

// Limit trzymany w bazie (nie w pamieci) - funkcje brzegowe chodza w wielu instancjach
// i licznik w Mapie resetuje sie przy kazdym zimnym starcie. Fail-open: awaria limitu
// nie moze zablokowac prawdziwego zapytania.
async function rateLimited(sb: ReturnType<typeof createClient>, ip: string): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_rate_limit", {
      p_bucket: `biz_inquiry:${ip}`, p_limit: 5, p_window_minutes: 60,
    });
    if (error) return false;
    return data === false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (await rateLimited(sb, ip)) return json({ error: "rate_limited" }, 429);

    const body = await req.json();
    const email = field(body.email, 254)?.toLowerCase() ?? "";
    const venueName = field(body.venue_name, 160);
    if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
    if (!venueName) return json({ error: "venue_name_required" }, 400);

    const row = {
      venue_name: venueName,
      city: field(body.city, 120),
      contact_name: field(body.contact_name, 120),
      email,
      phone: field(body.phone, 40),
      message: field(body.message, 2000),
      language: body.language === "en" ? "en" : "pl",
      source: field(body.source, 60) ?? "landing_b2c",
    };

    const { data, error } = await sb.from("business_inquiries").insert(row).select("id, created_at").single();
    if (error) throw new Error(`insert: ${error.message}`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const whenPL = new Date(data.created_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
      const line = (label: string, value: string | null) =>
        value ? `<p style="margin:8px 0;"><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "spontaway <noreply@spontaway.com>",
          to: ADMIN_EMAILS,
          reply_to: email,
          subject: `Zapytanie o ofertę: ${row.venue_name}`,
          html: `
            <h2 style="margin:0 0 12px;">Lokal pyta o ofertę</h2>
            ${line("Lokal", row.venue_name)}
            ${line("Miasto", row.city)}
            ${line("Osoba", row.contact_name)}
            ${line("E-mail", row.email)}
            ${line("Telefon", row.phone)}
            ${row.message ? `<p style="margin:8px 0;"><strong>Wiadomość:</strong><br>${escapeHtml(row.message).replace(/\n/g, "<br>")}</p>` : ""}
            ${line("Czas", whenPL)}
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;">
            <p style="margin:8px 0;font-size:12px;color:#666;">
              Odpowiedz na tego maila, żeby napisać prosto do lokalu.
              Lista zapytań: <a href="https://admin.spontaway.com">admin.spontaway.com</a>
            </p>
          `,
        }),
      });
      // Zapytanie jest juz w bazie - nieudany mail logujemy i oddajemy sukces klientowi.
      if (!res.ok) console.error("[business-inquiry] resend", await res.text());
    }

    return json({ ok: true, id: data.id });
  } catch (err: any) {
    console.error("[business-inquiry]", err);
    return json({ error: err?.message ?? "unknown" }, 500);
  }
});
