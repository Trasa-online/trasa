// =====================================================================
// lead-contact-lookup — Edge Function
// =====================================================================
// Szuka kontaktu do LEADA: lokalu, ktory userzy dodaja do kolekcji i wyjazdow,
// ale ktory nie ma jeszcze konta w spontaway.
//
// ⚠️ GOOGLE PLACES NIE ZWRACA ADRESOW E-MAIL. Ma strone i telefon - i tyle. Mail bierze
// sie ze STRONY lokalu: sciagamy strone glowna i typowe podstrony kontaktowe, po czym
// wyciagamy adresy z `mailto:` i z tresci. Dla czesci lokali (formularz, sam Instagram)
// nie bedzie zadnego wyniku i to jest normalny efekt, nie blad - wtedy zostaje telefon
// albo reczne wpisanie adresu w panelu.
//
// Wolane RECZNIE z panelu (guzik przy leadzie), nie hurtem: kazde wywolanie to dwa
// platne zapytania do Google.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GOOGLE = "https://maps.googleapis.com/maps/api";
const REFERER = "https://spontaway.com/";
const GOOGLE_DAILY_CALL_LIMIT = Number(Deno.env.get("GOOGLE_DAILY_CALL_LIMIT") ?? "2500");

// Przedstawiamy sie wlasciwie: wlasciciel strony ma widziec w logach, kto wszedl i po co.
// ⚠️ BEZ adresu e-mail w naglowku: pierwszy testowany lokal (veganaframen.pl) wypisywal
// User-Agent na stronie, wiec NASZ wlasny adres wracal jako "znaleziony kontakt lokalu".
const UA = "spontaway-lead-bot/1.0 (+https://spontaway.com/dla-firm)";

// Podstrony, na ktorych polskie i angielskie strony trzymaja kontakt. Kolejnosc = kolejnosc prob.
const CONTACT_PATHS = ["", "/kontakt", "/contact", "/kontakt.html", "/contact.html", "/o-nas", "/about", "/wspolpraca"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Atomowo rezerwuje n wywolan Google na dzis. Fail-open jak w pozostalych funkcjach:
// awaria licznika nie moze blokowac legalnej pracy.
async function consumeGoogleQuota(sb: any, n: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_google_quota", { p_n: n, p_limit: GOOGLE_DAILY_CALL_LIMIT });
    if (error) return true;
    return data !== false;
  } catch { return true; }
}

async function getText(url: string, ms = 7000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    const body = await res.text();
    return body.slice(0, 400_000); // strony bywaja ogromne, a kontakt jest zawsze na poczatku albo w stopce
  } catch { return null; }
  finally { clearTimeout(t); }
}

// Adresy, ktore NIE sa kontaktem do lokalu: pliki graficzne z @2x, sentry, dostawcy stron,
// skrzynki automatyczne. Bez tego filtra "logo@2x.png" ladowalo jako mail.
// Nasze wlasne domeny - zeby echo naszego naglowka albo link do nas w stopce nie wrocil
// jako kontakt do lokalu.
const OURS = /@(spontaway\.com|trasa\.travel)$/i;
const JUNK = /(@2x|\.png|\.jpe?g|\.webp|\.gif|\.svg|sentry|wixpress|wix\.com|squarespace|example\.(com|org)|domain\.com|noreply|no-reply|donotreply)/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Zapis omijajacy roboty: "kontakt (at) lokal.pl", "kontakt [małpa] lokal.pl".
const OBFUSCATED_RE = /([A-Za-z0-9._%+-]+)\s*(?:\(|\[)\s*(?:at|małpa|malpa|@)\s*(?:\)|\])\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;

// Prefiksy, ktore w praktyce trafiaja do wlasciciela albo menedzera, a nie do pustej skrzynki.
const PREFIX_RANK = ["kontakt", "contact", "biuro", "office", "info", "hello", "hi", "wspolpraca", "marketing", "rezerwacje", "recepcja", "manager", "restauracja", "cafe", "kawiarnia"];

function extractEmails(html: string, siteHost: string | null): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(EMAIL_RE)) found.add(m[0]);
  for (const m of html.matchAll(OBFUSCATED_RE)) found.add(`${m[1]}@${m[2]}`);

  const clean = [...found]
    .map((e) => e.toLowerCase().replace(/[.,;:]+$/, ""))
    .filter((e) => !JUNK.test(e) && !OURS.test(e) && e.length <= 80);

  const score = (e: string) => {
    const [prefix, domain] = e.split("@");
    let s = 0;
    // Adres w domenie lokalu jest wart wiecej niz gmail wklejony w stopce przez agencje.
    if (siteHost && domain && (domain === siteHost || siteHost.endsWith(`.${domain}`) || domain.endsWith(`.${siteHost}`))) s -= 100;
    const idx = PREFIX_RANK.indexOf(prefix);
    s += idx === -1 ? 50 : idx;
    s += e.length / 100;
    return s;
  };
  return [...new Set(clean)].sort((a, b) => score(a) - score(b)).slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  const sb = createClient(supabaseUrl, serviceRoleKey);

  // Dane kontaktowe firm - tylko dla admina panelu (wzorzec z admin-delete-business).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Forbidden - wymagana rola admin" }, 403);

  try {
    const body = await req.json();
    const placeName: string = String(body?.place_name ?? "").trim();
    const city: string | null = body?.city ? String(body.city).trim() : null;
    const googlePlaceId: string | null = body?.google_place_id ? String(body.google_place_id) : null;
    const force: boolean = body?.force === true;
    if (!placeName) return json({ error: "place_name required" }, 400);

    const placeKey = placeName.toLowerCase().trim();

    // 1. Cache: raz sprawdzony lokal nie musi kosztowac kolejnych wywolan Google.
    //    `city` bywa puste, a w SQL NULL nie rowna sie NULL - stad dwie galezie zapytania.
    let cacheQuery = sb.from("lead_contacts").select("*").eq("place_key", placeKey);
    cacheQuery = city ? cacheQuery.eq("city", city) : cacheQuery.is("city", null);
    const { data: cached } = await cacheQuery.maybeSingle();
    if (cached && !force) return json({ contact: cached, cached: true });

    if (!apiKey) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);
    if (!(await consumeGoogleQuota(sb, 2))) {
      return json({ error: "Dzienny limit wywołań Google wyczerpany - spróbuj jutro." }, 429);
    }

    // 2. Google: place_id -> strona i telefon. Adresu e-mail Google NIE ma.
    let placeId = googlePlaceId;
    if (!placeId) {
      const query = [placeName, city].filter(Boolean).join(" ");
      const res = await fetch(
        `${GOOGLE}/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&language=pl&key=${apiKey}`,
        { headers: { Referer: REFERER } },
      );
      const data = await res.json().catch(() => null);
      placeId = data?.candidates?.[0]?.place_id ?? null;
    }

    let website: string | null = null;
    let phone: string | null = null;
    if (placeId) {
      const res = await fetch(
        `${GOOGLE}/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=website,formatted_phone_number,international_phone_number,name&language=pl&key=${apiKey}`,
        { headers: { Referer: REFERER } },
      );
      const data = await res.json().catch(() => null);
      website = data?.result?.website ?? null;
      phone = data?.result?.formatted_phone_number ?? data?.result?.international_phone_number ?? null;
    }

    // 3. Strona lokalu -> adresy e-mail. Idziemy po podstronach kontaktowych, ale tylko
    //    do pierwszego trafienia - nie przegladamy calego serwisu.
    let emails: string[] = [];
    let sourceUrl: string | null = null;
    if (website) {
      let origin: string | null = null;
      let host: string | null = null;
      try { const u = new URL(website); origin = u.origin; host = u.hostname.replace(/^www\./, ""); } catch { /* zly url w Google */ }
      if (origin) {
        for (const path of CONTACT_PATHS) {
          const url = path ? `${origin}${path}` : website;
          const html = await getText(url);
          if (!html) continue;
          const found = extractEmails(html, host);
          if (found.length) { emails = found; sourceUrl = url; break; }
        }
      }
    }

    const row = {
      place_key: placeKey,
      place_name: placeName,
      city,
      website,
      phone,
      email: emails[0] ?? cached?.email ?? null,
      emails,
      source_url: sourceUrl,
      found_by: emails.length ? "website" : (phone || website) ? "google" : null,
      status: emails.length ? "found" : "not_found",
      checked_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = cached
      ? await sb.from("lead_contacts").update(row).eq("id", cached.id).select("*").single()
      : await sb.from("lead_contacts").insert(row).select("*").single();
    if (saveErr) throw saveErr;

    return json({ contact: saved, cached: false });
  } catch (err) {
    console.error("[lead-contact-lookup]", String(err));
    return json({ error: String(err) }, 500);
  }
});
