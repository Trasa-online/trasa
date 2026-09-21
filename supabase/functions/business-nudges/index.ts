import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildActivationReminderHtml, buildActivationReminderText,
  buildCompleteProfileHtml, buildCompleteProfileText, type MissingField,
} from "./emails.ts";

// PRZYPOMNIENIA DLA LOKALI, KTORE UTKNELY W REJESTRACJI (decyzja Nat 2026-09-21).
//
// Cron raz dziennie (`cron_business_nudges`, x-trigger-secret z Vault). Trzy rodzaje maili,
// kazdy najwyzej RAZ na wizytowke (UNIQUE w `business_nudges`):
//   activation_1     - >= 24 h od rejestracji, konto NIEAKTYWOWANE (email niepotwierdzony,
//                      zero logowan). Mail z NOWYM linkiem - stary (24 h) juz wygasl.
//   activation_2     - >= 4 dni od rejestracji, nadal nieaktywowane, po activation_1.
//   complete_profile - >= 2 dni od AKTYWACJI, wizytowka niekompletna (brak ktoregos z: kategoria,
//                      adres, zdjecie glowne, opis) i jeszcze NIEZATWIERDZONA - z lista brakow
//                      i linkiem do panelu. Zatwierdzona wizytowka jest juz w apce, wiec nie
//                      ma jej czego przypominac.
// Pomijamy szkice (`is_draft` - lead od nas, nie rejestracja lokalu) i wizytowki odrzucone.
//
// Wywolanie: cron / service_role / admin. Body: { dry_run?: true } = policz i oddaj plan,
// nic nie wysylaj i nic nie zapisuj; { test_to: "adres" } = wyslij WSZYSTKIE zaplanowane
// maile tylko na ten adres z prefiksem [TEST] w temacie, bez zapisu do `business_nudges`;
// { ignore_delays: true } (tylko z dry_run / test_to) = pomin progi czasowe.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const H = 60 * 60 * 1000;
const ACTIVATION_1_AFTER_MS = 24 * H;
const ACTIVATION_2_AFTER_MS = 4 * 24 * H;
const COMPLETE_AFTER_MS = 2 * 24 * H;
const SITE = "https://spontaway.com";

type Kind = "activation_1" | "activation_2" | "complete_profile";
type Plan = { profile_id: string; kind: Kind; email: string; business_name: string; missing?: MissingField[]; owner_user_id: string; place_id: string | null };

function missingFields(bp: any): MissingField[] {
  const out: MissingField[] = [];
  if ((bp.description ?? "").toString().trim().length < 20) out.push("description");
  if (!bp.main_category) out.push("category");
  if (!((bp.street ?? "").toString().trim() && (bp.city ?? "").toString().trim())) out.push("address");
  if (!((bp.phone ?? "").toString().trim() || (bp.website ?? "").toString().trim())) out.push("contact");
  if (!bp.opening_hours || Object.keys(bp.opening_hours).length === 0) out.push("hours");
  if (!(bp.cover_image_url || bp.cover_video_url)) out.push("cover");
  return out;
}
// „Niekompletna" = brakuje czegos, bez czego wizytowki nie da sie pokazac. Kontakt i godziny
// stoja na liscie brakow w mailu, ale same nie wyzwalaja przypomnienia.
const CORE: MissingField[] = ["category", "address", "cover", "description"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Guard: cron (sekret z Vault) / service_role / admin z aplikacji.
  const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
  const isTrigger = triggerSecret.length > 0 && req.headers.get("x-trigger-secret") === triggerSecret;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = isTrigger || bearer === serviceRoleKey;
  if (!allowed && bearer) {
    const { data: u } = await sb.auth.getUser(bearer);
    if (u?.user?.id) {
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      allowed = isAdmin === true;
    }
  }
  if (!allowed) return json({ error: "unauthorized" }, 401);

  let body: { dry_run?: boolean; test_to?: string; ignore_delays?: boolean } = {};
  try { body = await req.json(); } catch { /* pusty body z crona */ }
  const dryRun = body.dry_run === true;
  const testTo = typeof body.test_to === "string" && body.test_to.includes("@") ? body.test_to.trim() : null;
  // `ignore_delays` = pomin progi czasowe (24 h / 4 dni / 2 dni) - WYLACZNIE do podgladu
  // i wysylki testowej, nigdy do prawdziwych maili.
  const ignoreDelays = body.ignore_delays === true && (dryRun || !!testTo);
  const after = (elapsed: number, threshold: number) => ignoreDelays || elapsed >= threshold;

  try {
    const now = Date.now();
    const { data: profiles, error: pErr } = await sb
      .from("business_profiles")
      .select("id, business_name, email, owner_user_id, created_at, activated_at, is_draft, moderation_status, place_id, city, street, main_category, description, phone, website, opening_hours, cover_image_url, cover_video_url")
      .not("owner_user_id", "is", null)
      .eq("is_draft", false)
      .neq("moderation_status", "rejected");
    if (pErr) throw new Error(`business_profiles: ${pErr.message}`);

    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: sentRows } = ids.length
      ? await sb.from("business_nudges").select("business_profile_id, kind").in("business_profile_id", ids)
      : { data: [] as any[] };
    const sent = new Set(((sentRows ?? []) as any[]).map((r) => `${r.business_profile_id}:${r.kind}`));
    const has = (id: string, kind: Kind) => sent.has(`${id}:${kind}`);

    const plans: Plan[] = [];
    for (const bp of (profiles ?? []) as any[]) {
      const { data: au } = await sb.auth.admin.getUserById(bp.owner_user_id);
      const user = au?.user;
      if (!user) continue;
      const email = (user.email ?? bp.email ?? "").toString().trim();
      if (!email) continue;
      const createdAt = new Date(bp.created_at).getTime();
      // Aktywacja = potwierdzony email (klik w link i ustawione haslo) albo jakiekolwiek logowanie.
      const activatedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime()
        : user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime()
        : bp.activated_at ? new Date(bp.activated_at).getTime()
        : null;
      const base = { profile_id: bp.id, email, business_name: (bp.business_name ?? "Twój lokal").toString().slice(0, 120), owner_user_id: bp.owner_user_id, place_id: bp.place_id ?? null };

      if (!activatedAt) {
        if (after(now - createdAt, ACTIVATION_2_AFTER_MS) && has(bp.id, "activation_1") && !has(bp.id, "activation_2")) {
          plans.push({ ...base, kind: "activation_2" });
        } else if (after(now - createdAt, ACTIVATION_1_AFTER_MS) && !has(bp.id, "activation_1")) {
          plans.push({ ...base, kind: "activation_1" });
        }
        continue;
      }
      if (bp.moderation_status === "approved") continue;
      const missing = missingFields(bp);
      if (!missing.some((m) => CORE.includes(m))) continue;
      if (after(now - activatedAt, COMPLETE_AFTER_MS) && !has(bp.id, "complete_profile")) {
        plans.push({ ...base, kind: "complete_profile", missing });
      }
    }

    if (dryRun) return json({ ok: true, dry_run: true, planned: plans.map((p) => ({ ...p, owner_user_id: undefined })) });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    // Nowy link aktywacyjny: ta sama kaskada, co w `register-business` - `invite` dziala dla
    // konta, ktore nigdy nie potwierdzilo maila; gdyby nie, `magiclink` tez konczy na
    // `/set-password-biznes` (SetPassword przyjmuje kazdy z tych typow).
    const activationLink = async (email: string): Promise<string | null> => {
      for (const type of ["invite", "magiclink"] as const) {
        const { data, error } = await sb.auth.admin.generateLink({ type, email, options: { redirectTo: `${SITE}/#/set-password-biznes` } });
        const hashed = data?.properties?.hashed_token;
        if (!error && hashed) return `${SITE}/?token_hash=${hashed}&type=${type}#/set-password-biznes`;
      }
      return null;
    };

    const results: { profile_id: string; kind: Kind; ok: boolean; error?: string }[] = [];
    for (const p of plans) {
      let subject = "";
      let html = "";
      let text = "";
      if (p.kind === "complete_profile") {
        const panelUrl = `${SITE}/biznes/${encodeURIComponent(p.place_id ?? p.profile_id)}`;
        subject = `Dokończ wizytówkę ${p.business_name}, żeby pojawić się w spontaway`;
        html = buildCompleteProfileHtml({ businessName: p.business_name, panelUrl, missing: p.missing ?? [] });
        text = buildCompleteProfileText({ businessName: p.business_name, panelUrl, missing: p.missing ?? [] });
      } else {
        // W trybie testowym NIE generujemy prawdziwego linku: to zywy token do cudzego
        // konta, a mail idzie na adres testera. Zamiast niego atrapa.
        const url = testTo ? `${SITE}/?token_hash=TEST&type=invite#/set-password-biznes` : await activationLink(p.email);
        if (!url) { results.push({ profile_id: p.profile_id, kind: p.kind, ok: false, error: "no activation link" }); continue; }
        const last = p.kind === "activation_2";
        subject = last ? "Ostatnie przypomnienie: aktywuj konto w spontaway" : "Twoje konto w spontaway czeka na aktywację";
        html = buildActivationReminderHtml({ businessName: p.business_name, activationUrl: url, last });
        text = buildActivationReminderText({ businessName: p.business_name, activationUrl: url, last });
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "spontaway <hello@spontaway.com>",
          to: [testTo ?? p.email],
          subject: testTo ? `[TEST] ${subject}` : subject,
          html, text,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[business-nudges] resend:", p.kind, p.profile_id, err.slice(0, 300));
        results.push({ profile_id: p.profile_id, kind: p.kind, ok: false, error: err.slice(0, 200) });
        continue;
      }
      results.push({ profile_id: p.profile_id, kind: p.kind, ok: true });
      // Tryb testowy nie zapisuje - prawdziwy nudge ma pojsc do lokalu przy nastepnym cronie.
      if (!testTo) {
        await sb.from("business_nudges").insert({ business_profile_id: p.profile_id, kind: p.kind, email: p.email });
      }
    }
    return json({ ok: true, test_to: testTo, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
  } catch (err: any) {
    console.error("[business-nudges]", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
