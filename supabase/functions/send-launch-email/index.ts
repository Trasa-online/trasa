// Wysylka maila o premierze do OCZEKUJACYCH z waitlisty (2026-09-11). Admin-only.
//
// Bezpieczniki, w kolejnosci:
//  1. Tylko admin (user_roles role='admin') - jak admin-analytics.
//  2. DOMYSLNIE PROBA NA SUCHO: bez `confirm: true` funkcja tylko zwraca liste adresatow
//     i nic nie wysyla. Realna wysylka wymaga jawnego potwierdzenia w body.
//  3. Adresaci = wpisy waitlisty BEZ konta (osoba z kontem juz ma aplikacje) i BEZ
//     notified_at (mail o premierze jest JEDEN; kolumna waitlist.notified_at to nasz
//     znacznik "wyslano"). Powtorne wywolanie po przerwaniu wysyla tylko do reszty.
//  4. Sekwencyjnie, z krotka przerwa - Resend limituje tempo; przy 17 adresatach to sekundy.
//
// Body: { confirm?: boolean, limit?: number, store_url?: string, test_to?: string }
//   test_to: wysyla JEDEN mail testowy na podany adres (bez dotykania waitlisty) - do
//   obejrzenia szablonu w prawdziwej skrzynce przed premiera.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLaunchHtml, launchSubject, type MailLang } from "./launch.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_STORE_URL = "https://apps.apple.com/app/id6777705751";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendOne(apiKey: string, to: string, lang: MailLang, storeUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "spontaway <hello@spontaway.com>",
      to: [to],
      subject: launchSubject(lang),
      html: buildLaunchHtml(lang, storeUrl),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`resend ${res.status}: ${JSON.stringify(data)}`);
  return data?.id as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // ── Auth: tylko admin ──
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden - admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const confirm = body?.confirm === true;
    const limit = Math.max(1, Math.min(Number(body?.limit ?? 500), 500));
    const storeUrl = typeof body?.store_url === "string" && /^https:\/\//.test(body.store_url) ? body.store_url : DEFAULT_STORE_URL;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Mail testowy na jeden adres - szablon w prawdziwej skrzynce, waitlista nietknieta.
    if (typeof body?.test_to === "string" && body.test_to.includes("@")) {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
      const lang: MailLang = body?.lang === "en" ? "en" : "pl";
      const id = await sendOne(RESEND_API_KEY, body.test_to.trim(), lang, storeUrl);
      return json({ ok: true, test: true, to: body.test_to, id });
    }

    // ── Adresaci: waitlista bez konta i bez wyslanego maila o premierze ──
    // Zlaczenie z auth.users robi baza (RPC admin_launch_recipients, SECURITY DEFINER) -
    // Admin API listUsers padalo przy >1000 kontach goscinnych.
    const { data: rows, error: wlErr } = await admin.rpc("admin_launch_recipients");
    if (wlErr) throw wlErr;
    const recipients = ((rows ?? []) as { id: string; email: string; language: string | null }[]).slice(0, limit);
    const { count: totalWaiting } = await admin.from("waitlist").select("id", { count: "exact", head: true }).is("notified_at", null);

    if (!confirm) {
      return json({
        ok: true, dry_run: true,
        would_send: recipients.length,
        skipped_have_account: Math.max(0, (totalWaiting ?? 0) - (rows ?? []).length),
        recipients: recipients.map((r) => ({ email: r.email, lang: r.language === "en" ? "en" : "pl" })),
        store_url: storeUrl,
        hint: "Wyslij ponownie z { confirm: true }, zeby faktycznie wyslac.",
      });
    }

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
    const sent: string[] = []; const failed: { email: string; error: string }[] = [];
    for (const r of recipients) {
      const lang: MailLang = r.language === "en" ? "en" : "pl";
      try {
        await sendOne(RESEND_API_KEY, String(r.email).trim(), lang, storeUrl);
        // Znacznik od razu po udanej wysylce - przerwana petla nie wysle nikomu dwa razy.
        await admin.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
        sent.push(r.email);
      } catch (e) {
        failed.push({ email: r.email, error: e instanceof Error ? e.message : String(e) });
      }
      await sleep(600);
    }
    console.log(`[send-launch-email] sent=${sent.length} failed=${failed.length} by=${userData.user.email}`);
    return json({ ok: true, dry_run: false, sent: sent.length, failed, store_url: storeUrl });
  } catch (err) {
    console.error("[send-launch-email]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
