import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BASE = "https://maps.googleapis.com/maps/api";
const REFERER = "https://spontaway.com/";
const CACHE_TTL_HOURS = 168; // 7 days

// ── TRZY BEZPIECZNIKI, KAZDY O CZYM INNYM (przebudowa 2026-09-22) ────────────
// Po przejsciu na Autocomplete w sesji wiekszosc zapytan jest DARMOWA, a placimy wylacznie za
// `resolve` (Place Details w chwili wyboru miejsca). Dlatego limit od liczby zapytan przestal
// byc limitem kosztu i musi byc DUZO wyzszy - inaczej przy 10 tys. userow odcialby wyszukiwarke
// wszystkim przy rachunku rzedu kilkuset zlotych.
//
// 1. DZIENNY limit zapytan = bezpiecznik DOSTEPNOSCI (petla w kodzie, bot, zly skrypt).
//    60 000/dobe to z grubsza ruch 15-20 tys. aktywnych userow.
const GOOGLE_DAILY_CALL_LIMIT = Number(Deno.env.get("GOOGLE_DAILY_CALL_LIMIT") ?? "60000");

// 2. MIESIECZNY budzet PLATNYCH resolve = bezpiecznik KOSZTOWY (twardy sufit rachunku).
//    30 000 resolve to ~510 $ przy starym Place Details (17 $/1000) albo ~100 $ po wlaczeniu
//    Places API (New) (5 $/1000, pula 10 000 darmowych). Fail-CLOSED: gdy licznik nie odpowiada,
//    NIE wolamy Google - przy pieniadzach wolimy brak wyniku niz niespodzianke na rachunku.
const GOOGLE_RESOLVE_MONTHLY_LIMIT = Number(Deno.env.get("GOOGLE_RESOLVE_MONTHLY_LIMIT") ?? "30000");

// Miesieczny limit BUDZETOWY dla Text Search (wyszukiwarka). 8000/mies ~= $256 @ $32/1000
// (cel: max ~$260/mies na wyszukiwarce). Env-configurable.
const GOOGLE_TEXTSEARCH_MONTHLY_LIMIT = Number(Deno.env.get("GOOGLE_TEXTSEARCH_MONTHLY_LIMIT") ?? "8000");

// Atomowo rezerwuje n wywolan Google na dzis. false => limit przekroczony (NIE wolaj Google).
// Fail-open: gdy RPC niedostepny/blad -> przepuszczamy (nie blokujemy legalnego ruchu).
async function consumeGoogleQuota(sb: ReturnType<typeof createClient>, n: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_google_quota", { p_n: n, p_limit: GOOGLE_DAILY_CALL_LIMIT });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

// Atomowo rezerwuje n wywolan Text Search na biezacy miesiac. false => budzet wyczerpany.
// Fail-CLOSED: gdy RPC niedostepny/blad -> BLOKUJEMY (priorytet: zero ryzyka rachunku).
async function consumeTextsearchMonthly(sb: ReturnType<typeof createClient>, n: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_textsearch_month", { p_n: n, p_limit: GOOGLE_TEXTSEARCH_MONTHLY_LIMIT });
    if (error) { console.error("textsearch monthly quota rpc error:", error.message); return false; }
    return data !== false;
  } catch (e) {
    console.error("textsearch monthly quota exception:", (e as Error).message);
    return false;
  }
}

// ── Limit na WOLAJACEGO (audyt M5, 2026-09-08) ───────────────────────────────
// Kwoty wyzej to bezpiecznik KOSZTOWY (globalny). Ten jest bezpiecznikiem DOSTEPNOSCI:
// bez niego jeden skrypt wypala dzienny budzet w kilka minut i wyszukiwarka pada
// WSZYSTKIM. Limit per wolajacy zamienia awarie calej apki na odciecie jednego naduzywajacego.
const PER_CALLER_HOURLY_LIMIT = Number(Deno.env.get("GOOGLE_PROXY_HOURLY_PER_CALLER") ?? "250");

/**
 * Kubelek wolajacego: id usera z tokenu, a gdy go nie ma - adres IP.
 * Uwaga: `sub` czytamy z tokenu BEZ weryfikacji podpisu. To swiadome - tu nie podejmujemy
 * decyzji o dostepie, tylko rozdzielamy ruch na kubelki, a sprawdzanie podpisu kosztowaloby
 * dodatkowe zapytanie przy KAZDYM wywolaniu proxy. Sufit kosztu i tak trzyma globalna kwota.
 */
function callerBucket(req: Request): string {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const sub = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))?.sub;
      if (sub) return `gplaces:u:${sub}`;
    } catch { /* nie JWT - lecimy po IP */ }
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return `gplaces:ip:${ip || "unknown"}`;
}

// ── Miesieczny limit PLATNYCH wywolan na KONTO (2026-09-22) ──────────────────
// Kwota dzienna chroni rachunek globalnie, limit godzinowy chroni dostepnosc, a ten chroni
// przed jednym kontem, ktore w tle miele Google przez caly miesiac. Fail-open: chwilowy blad
// bazy nie moze odciac szukania, bo sufit kosztu i tak trzyma kwota globalna.
// 3. Miesieczny limit zapytan NA KONTO. ~1000 zapytan to okolo 140 sesji wyszukiwania,
// czyli kilkanascie razy wiecej, niz robi czlowiek. Chroni przed jednym kontem w petli.
const PER_USER_MONTHLY_LIMIT = Number(Deno.env.get("GOOGLE_MONTHLY_PER_USER") ?? "1000");

function callerUserId(req: Request): string | null {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const sub = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))?.sub;
    return typeof sub === "string" ? sub : null;
  } catch { return null; }
}

// Fail-CLOSED: to jest bezpiecznik pieniedzy, nie dostepnosci.
async function resolveBudgetLeft(sb: ReturnType<typeof createClient>, n: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_resolve_month", { p_n: n, p_limit: GOOGLE_RESOLVE_MONTHLY_LIMIT });
    if (error) { console.error("resolve budget rpc error:", error.message); return false; }
    return data !== false;
  } catch (e) {
    console.error("resolve budget exception:", (e as Error).message);
    return false;
  }
}

async function userWithinMonthlyLimit(sb: ReturnType<typeof createClient>, req: Request, n: number): Promise<boolean> {
  const uid = callerUserId(req);
  if (!uid) return true;
  try {
    const { data, error } = await sb.rpc("try_consume_user_google_quota", { p_user: uid, p_n: n, p_limit: PER_USER_MONTHLY_LIMIT });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

// Fail-open: gdy RPC padnie, przepuszczamy. To limit uczciwosci, nie brama bezpieczenstwa -
// zablokowanie legalnego ruchu przez chwilowy blad bazy byloby gorsze niz brak limitu.
async function callerWithinLimit(sb: ReturnType<typeof createClient>, req: Request): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_rate_limit", {
      p_bucket: callerBucket(req), p_limit: PER_CALLER_HOURLY_LIMIT, p_window_minutes: 60,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

// In-memory caches (live for the duration of the function instance)
const citysearchCache = new Map<string, { results: any[]; ts: number }>();
const textsearchCache = new Map<string, { results: any[]; ts: number }>();
const CITYSEARCH_TTL_MS = 86_400_000;   // 24 hours
const TEXTSEARCH_TTL_MS = 604_800_000;  // 7 days

function nameMatches(requested: string, found: string): boolean {
  const tok = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const a = tok(requested);
  const b = new Set(tok(found));
  if (a.length === 0 || b.size === 0) return false;
  return a.some(t => b.has(t));
}

function cacheKey(placeName: string, city?: string): string {
  return `${placeName}|${city ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey);

  if (!(await callerWithinLimit(sb, req))) {
    return new Response(JSON.stringify({ error: "rate_limited", results: [], result: null }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "600" },
    });
  }

  try {
    const body = await req.json();

    // ── Non-detail actions (no cache needed) ─────────────────────────────────

    // ── AUTOCOMPLETE W SESJI (2026-09-22) - to zastepuje Text Search przy pisaniu ──────
    // Text Search kosztuje 32 $/1000 i platny jest KAZDY nacisniety klawisz (debounce lapie
    // tylko czesc). Autocomplete z tokenem sesji jest DARMOWY, gdy sesje zamyka Place Details
    // (SKU "Autocomplete Session Usage"), a bez niego kosztuje 2,83 $/1000 z pula 10 000/mies.
    // ⚠️ Token sesji MUSI byc ten sam dla calego pisania i dla koncowego `placeid`, inaczej
    // Google liczy kazde zapytanie osobno. Klient trzyma go w `placeSearchSession.ts`.
    if (body.action === "autocomplete") {
      const input = typeof body.query === "string" ? body.query.trim() : "";
      if (input.length < 2) {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!(await userWithinMonthlyLimit(sb, req, 1))) {
        return new Response(JSON.stringify({ results: [], quota_exceeded: true, period: "user_month" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "USER-MONTH-EXCEEDED" },
        });
      }
      if (!(await consumeGoogleQuota(sb, 1))) {
        return new Response(JSON.stringify({ results: [], quota_exceeded: true, period: "day" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "EXCEEDED" },
        });
      }
      const params = new URLSearchParams({ input, key: apiKey, language: "pl" });
      const token = typeof body.sessionToken === "string" ? body.sessionToken.slice(0, 64) : "";
      if (token) params.set("sessiontoken", token);
      // `types=establishment` odsiewa adresy i dzielnice - do wyjazdu dodaje sie LOKALE.
      // Wyszukiwarka miast podaje wlasne `(cities)`.
      params.set("types", typeof body.types === "string" ? body.types : "establishment");
      // Zasieg krajowy - nakierowanie, ktore nic nie kosztuje, a decyduje o trafnosci
      // (bez niego plan do Francji dostawal podpowiedzi z Polski).
      if (typeof body.country === "string" && /^[a-z]{2}$/i.test(body.country)) {
        params.set("components", `country:${body.country.toLowerCase()}`);
      }
      if (typeof body.latitude === "number" && typeof body.longitude === "number") {
        params.set("location", `${body.latitude},${body.longitude}`);
        params.set("radius", String(Math.max(1000, Math.min(50000, Number(body.radius) || 20000))));
      }
      const res = await fetch(`${BASE}/place/autocomplete/json?${params.toString()}`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const results = ((data.predictions ?? []) as any[]).slice(0, 8).map((p: any) => ({
        name: p.structured_formatting?.main_text ?? p.description ?? "",
        // Drugi wiersz podpowiedzi to ulica i miasto - pelnego adresu Autocomplete nie daje,
        // dociagamy go dopiero przy WYBORZE (akcja `placeid`).
        secondary: p.structured_formatting?.secondary_text ?? "",
        place_id: p.place_id ?? null,
        types: p.types ?? [],
      })).filter((r: any) => r.place_id);
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "citysearch") {
      const cacheHit = citysearchCache.get(body.query);
      if (cacheHit && Date.now() - cacheHit.ts < CITYSEARCH_TTL_MS) {
        return new Response(JSON.stringify({ results: cacheHit.results }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } });
      }
      const ctok = typeof body.sessionToken === "string" ? `&sessiontoken=${encodeURIComponent(body.sessionToken.slice(0, 64))}` : "";
      const res = await fetch(`${BASE}/place/autocomplete/json?input=${encodeURIComponent(body.query)}&types=(cities)&key=${apiKey}&language=pl${ctok}`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const results = ((data.predictions ?? []) as any[]).slice(0, 5).map((p: any) => ({
        name: p.structured_formatting?.main_text ?? p.description,
        full_address: p.description,
      }));
      citysearchCache.set(body.query, { results, ts: Date.now() });
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Miejsca WOKOL punktu - "dodaj miejsce z mapy" (2026-09-08). User przesuwa mape, a my
    // pokazujemy, co jest pod pinezka. Wpisywanie nazwy odpada, gdy user wie GDZIE cos bylo,
    // ale nie pamieta JAK sie nazywalo.
    if (body.action === "nearby") {
      const { latitude, longitude } = body;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Promien z klienta (mapa z pinezka pyta "co jest DOKLADNIE tutaj" = 30 m; stary domyslny
      // 150 m zostaje dla pozostalych wywolan). Zakres 20-150, zeby nikt nie zrobil z tego
      // skanera okolicy.
      const radius = Math.max(20, Math.min(150, Math.round(Number(body.radius) || 150)));
      // Klucz cache zaokraglony do ~11 m: przesuwanie mapy o metr nie moze generowac nowego
      // platnego zapytania (ta sama zasada, co w proxy statycznych map).
      const nkey = `nearby|${latitude.toFixed(4)}|${longitude.toFixed(4)}|${radius}`;
      const nhit = textsearchCache.get(nkey);
      if (nhit && Date.now() - nhit.ts < CITYSEARCH_TTL_MS) {
        return new Response(JSON.stringify({ results: nhit.results }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } });
      }
      if (!(await consumeGoogleQuota(sb, 1))) {
        return new Response(JSON.stringify({ results: [], quota_exceeded: true }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "EXCEEDED" } });
      }
      const res = await fetch(`${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const results = ((data.results ?? []) as any[])
        // Bez wyników "administracyjnych" (dzielnice, drogi, kody pocztowe) - to nie sa miejsca,
        // ktore ktos dodaje do wyjazdu.
        .filter((r: any) => !(r.types ?? []).some((tp: string) => ["locality", "political", "route", "postal_code", "administrative_area_level_1", "administrative_area_level_2"].includes(tp)))
        .slice(0, 12)
        .map((r: any) => ({
          name: r.name ?? "",
          address: r.vicinity ?? r.formatted_address ?? "",
          place_id: r.place_id ?? null,
          types: r.types ?? [],
          rating: r.rating ?? null,
          latitude: r.geometry?.location?.lat ?? null,
          longitude: r.geometry?.location?.lng ?? null,
          photo_reference: r.photos?.[0]?.photo_reference ?? null,
        }));
      textsearchCache.set(nkey, { results, ts: Date.now() });
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Miejsce po IDENTYFIKATORZE z podkladu mapy (tapniecie w etykiete lokalu w Maps JS daje
    // placeId za darmo). Tylko pola podstawowe (Basic Data = najtansza pula), bez zdjec i opinii.
    // Cache w place_details_cache pod kluczem pid:<id> przez 7 dni - ten sam lokal tapniety przez
    // kogokolwiek drugi raz nic nie kosztuje.
    if (body.action === "placeid") {
      const pid = typeof body.place_id === "string" ? body.place_id.trim() : "";
      if (!pid || pid.length > 300) {
        return new Response(JSON.stringify({ result: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pkey = `pid:${pid}`;
      const { data: hit } = await sb.from("place_details_cache").select("data, cached_at").eq("cache_key", pkey).maybeSingle();
      if (hit && (Date.now() - new Date(hit.cached_at).getTime()) / 3_600_000 < CACHE_TTL_HOURS) {
        return new Response(JSON.stringify(hit.data), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } });
      }
      if (!(await userWithinMonthlyLimit(sb, req, 1))) {
        return new Response(JSON.stringify({ result: null, quota_exceeded: true, period: "user_month" }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "USER-MONTH-EXCEEDED" } });
      }
      // ⚠️ TO jest zapytanie, za ktore placimy - i tylko ono liczy sie do budzetu miesiecznego.
      if (!(await resolveBudgetLeft(sb, 1))) {
        return new Response(JSON.stringify({ result: null, quota_exceeded: true, period: "resolve_month" }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "RESOLVE-MONTH-EXCEEDED" } });
      }
      if (!(await consumeGoogleQuota(sb, 1))) {
        return new Response(JSON.stringify({ result: null, quota_exceeded: true }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "EXCEEDED" } });
      }
      // ⚠️ `sessiontoken` ZAMYKA sesje autocomplete - dzieki temu wszystkie podpowiedzi
      // z pisania sa darmowe, a placi sie tylko za to jedno zapytanie. Bez tokenu kazda
      // podpowiedz jest liczona osobno.
      const stok = typeof body.sessionToken === "string" ? `&sessiontoken=${encodeURIComponent(body.sessionToken.slice(0, 64))}` : "";
      const res = await fetch(`${BASE}/place/details/json?place_id=${encodeURIComponent(pid)}&fields=place_id,name,formatted_address,geometry,types&key=${apiKey}&language=pl${stok}`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const r = data?.result;
      const payload = {
        result: r ? {
          name: r.name ?? "",
          full_address: r.formatted_address ?? "",
          latitude: r.geometry?.location?.lat ?? null,
          longitude: r.geometry?.location?.lng ?? null,
          types: r.types ?? [],
          place_id: r.place_id ?? pid,
        } : null,
      };
      if (payload.result) {
        sb.from("place_details_cache").upsert({ cache_key: pkey, data: payload, cached_at: new Date().toISOString() }, { onConflict: "cache_key" })
          .then(() => {}, (e: Error) => console.error("placeid cache write:", e.message));
      }
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "textsearch") {
      // Opcjonalne nakierowanie na punkt (mapa z pinezka): Google szuka nazwy NAJPIERW w poblizu,
      // wiec "Yacht Beach Bar" trafia w ten we Vlorze, a nie w pierwszy lepszy na swiecie.
      // Klucz cache z siatka ~110 m - ta sama fraza z tego samego miejsca = zero kosztu.
      const biased = typeof body.latitude === "number" && typeof body.longitude === "number";
      const tkey = biased ? `${body.query}|${body.latitude.toFixed(3)}|${body.longitude.toFixed(3)}` : body.query;
      const cacheHit = textsearchCache.get(tkey);
      if (cacheHit && Date.now() - cacheHit.ts < TEXTSEARCH_TTL_MS) {
        return new Response(JSON.stringify({ results: cacheHit.results }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } });
      }
      // 1) Miesieczny budzet (~$256, fail-CLOSED) - twardy sufit kosztu wyszukiwarki.
      if (!(await consumeTextsearchMonthly(sb, 1))) {
        return new Response(JSON.stringify({ results: [], quota_exceeded: true, period: "month" }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "MONTH-EXCEEDED" } });
      }
      // 2) Dzienny burst limit (fail-open).
      if (!(await consumeGoogleQuota(sb, 1))) {
        return new Response(JSON.stringify({ results: [], quota_exceeded: true, period: "day" }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "EXCEEDED" } });
      }
      const bias = biased ? `&location=${body.latitude},${body.longitude}&radius=3000` : "";
      const res = await fetch(`${BASE}/place/textsearch/json?query=${encodeURIComponent(body.query)}${bias}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const results = ((data.results ?? []) as any[]).slice(0, 6).map((r: any) => ({
        name: r.name ?? "",
        full_address: r.formatted_address ?? "",
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
        types: r.types ?? [],
        // Identyfikator Google. Bez niego dodane miejsce nie da sie polaczyc z naszym rekordem
        // w `places` ani z wizytowka biznesowa - lokal z kontem dostawal wizytowke "zero"
        // (zgloszenie Nat 2026-09-01: Wanderlust). Klucz, nie zdjecie: nic nie kosztuje.
        place_id: r.place_id ?? null,
      }));
      textsearchCache.set(tkey, { results, ts: Date.now() });
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Place details (main path — with 7-day cache) ──────────────────────────

    const { placeName, latitude, longitude, city, googlePlaceId: knownPlaceId, placeDbId } = body;
    const hasCoords = latitude && longitude && Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001;
    const key = cacheKey(placeName, city);

    // 1. Cache check
    const { data: cached } = await sb
      .from("place_details_cache")
      .select("data, cached_at")
      .eq("cache_key", key)
      .single();

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 3_600_000;
      if (ageHours < CACHE_TTL_HOURS) {
        // Cache HIT — return immediately, $0 Google cost
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
      // Cache stale — continue to fetch fresh data
    }

    // Quota guard (bezpiecznik kosztowy): ten path robi kilka platnych wywolan
    // (Nearby/Text Search + Place Details). Po przekroczeniu dziennego limitu zwracamy
    // stale cache (jesli jest) albo pusty wynik - NIE wolamy Google.
    const okQuota = await consumeGoogleQuota(sb, 3);
    if (!okQuota) {
      if (cached?.data) {
        return new Response(JSON.stringify(cached.data), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "STALE-QUOTA" } });
      }
      return new Response(JSON.stringify({ result: null, quota_exceeded: true }), { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Quota": "EXCEEDED" } });
    }

    // 2. Resolve place_id
    let resolvedPlaceId: string | undefined = knownPlaceId || undefined;

    if (!resolvedPlaceId && hasCoords) {
      for (const radius of [100, 300]) {
        const r = await fetch(`${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
        const d = await r.json();
        const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
        if (match) { resolvedPlaceId = match.place_id; break; }
      }
    }

    if (!resolvedPlaceId) {
      const query = city ? `${placeName} ${city}` : placeName;
      const r = await fetch(`${BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const d = await r.json();
      const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
      if (match) resolvedPlaceId = match.place_id;
    }

    if (!resolvedPlaceId) {
      return new Response(JSON.stringify({ error: "Place not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Fetch place details from Google
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${resolvedPlaceId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary,place_id&reviews_sort=newest&language=pl&key=${apiKey}`,
      { headers: { Referer: REFERER } }
    );
    const detailData = await detailRes.json();

    if (detailData.result) {
      if (detailData.result.photos?.length > 3) {
        detailData.result.photos = detailData.result.photos.slice(0, 3);
      }

      // Strip API key from photo URLs — client uses /api/place-photo proxy instead
      // photo_reference stays in the response; PlaceSwiperDetail calls getPhotoUrl(ref)
      if (detailData.result.photos) {
        detailData.result.photos = detailData.result.photos.map((p: any) => ({
          photo_reference: p.photo_reference,
          width: p.width,
          height: p.height,
          // photo_url intentionally omitted — use /api/place-photo proxy on client
        }));
      }

      // Auto-save Place ID for future fast-path
      if (placeDbId && !knownPlaceId) {
        sb.from("places").update({ google_place_id: resolvedPlaceId }).eq("id", placeDbId).then(() => {});
      }
    }

    // 4. Store in cache (upsert — overwrite if stale)
    sb.from("place_details_cache")
      .upsert({ cache_key: key, data: detailData, cached_at: new Date().toISOString() })
      .then(() => {});

    return new Response(JSON.stringify(detailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });

  } catch (error) {
    console.error("google-places-proxy error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
