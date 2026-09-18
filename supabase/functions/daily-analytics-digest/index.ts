// =====================================================================
// daily-analytics-digest — Edge Function
// =====================================================================
// Codziennie wysyła jeden zbiorczy raport do zespołu (lista ALERT_EMAILS):
//   - Konta: nowe (24h) + łącznie (Supabase = źródło prawdy)
//   - Wyjazdy: nowe (24h, w tym ukończone) + łącznie + aktywacja (% userów z ≥1 wyjazdem)
//   - Kolekcje: nowe (24h) + łącznie (Supabase) oraz "utworzone" / "dodane miejsca" z PostHoga
//   - Zaangażowanie/retencja: DAU / WAU / MAU (PostHog, distinct person_id)
//   - Najczęstsze zdarzenia (24h) z PostHoga - proste nazwy, bez zdarzeń technicznych
//
// KONTA WEWNETRZNE (INTERNAL_EMAILS) sa WYLACZONE z kazdej liczby: z PostHoga po e-mailu
// osoby, z Supabase po id usera (rozwiazanym z e-maila przez auth.admin). Bez tego kazdy
// test zalozycieli wygladal w raporcie jak ruch userow.
//   - Waitlista: ile osob czeka, kto doszedl w ciagu doby, ile juz ma konto
//
// Źródła: Supabase (konta/wyjazdy/kolekcje) + PostHog (zdarzenia/aktywni). Wysyłka: Resend.
// Cron: codziennie 07:00 UTC (~9:00 Europe/Warsaw) via pg_cron + pg_net.
// Wzorce: monitor-user-threshold (Resend) + admin-analytics (HogQL).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Odbiorcy raportu dziennego. Jedna lista - dopisanie kogos to jedna linijka i redeploy funkcji.
// hello@ trzymamy jako adres firmowy (archiwum raportow poza prywatnymi skrzynkami).
const ALERT_EMAILS = [
  "nat.maz98@gmail.com",
  "hello@spontaway.com",
  "tomalab97@gmail.com",
  "maciej.meszynski123@gmail.com",
];
// Konta zespolu - NIE licza sie do zadnej statystyki (prosba Nat 2026-09-18). Ta sama lista
// siedzi po stronie klienta w src/lib/internalAccounts.ts (tam wylacza capture PostHoga u zrodla);
// tutaj filtrujemy dodatkowo, bo historyczne zdarzenia juz w PostHogu sa.
const INTERNAL_EMAILS = ["nat.maz98@gmail.com", "tomalab97@gmail.com"];
// Id tych kont w auth.users, wpisane NA SZTYWNO: `auth.admin.listUsers` stronicuje po 1000,
// a auth.users ma tysiace osieroconych kont anonimowych z dawnego trybu goscia, wiec
// zalozyciele nie mieszcza sie na pierwszej stronie (dry-run 2026-09-18: internalExcluded=0).
// Nowe konto zespolu = e-mail wyzej + id z `select id, email from auth.users`.
const INTERNAL_USER_IDS: Record<string, string> = {
  "nat.maz98@gmail.com": "e8e691a5-e622-437a-add6-7974b9634c8b",
  "tomalab97@gmail.com": "99148a59-ea09-49bf-9ace-0318cb2fa7a3",
};
const POSTHOG_HOST = "https://eu.posthog.com";
const PRIVATE_KEY = Deno.env.get("POSTHOG_PRIVATE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── PostHog HogQL (wzorzec z admin-analytics) ──
// ⚠️ Zapytania ida SEKWENCYJNIE, nie w Promise.all: PostHog przy kilku rownoleglych HogQL
// z jednego klucza odpowiada "Queries are a little too busy right now" (zlapane 2026-09-18
// przy siedmiu naraz) i takie pole w raporcie wychodzilo jako 0. Przy "too busy" probujemy
// jeszcze dwa razy z odstepem.
async function phQuery(query: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PRIVATE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      });
      if (res.ok) return await res.json();
      const text = await res.text().catch(() => "");
      const busy = res.status === 429 || res.status >= 500 || /too busy/i.test(text);
      console.error(`PostHog query error (attempt ${attempt + 1}):`, text.slice(0, 300));
      if (!busy) return null;
    } catch (e) {
      console.error("PostHog query exception:", String(e));
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
}
// Fragment WHERE wykluczajacy konta wewnetrzne - po `distinct_id` (= id usera Supabase, bo
// `posthog.identify(user.id)`), NIE po `person.properties.email` ani `person_id`: oba wymagaja
// zlaczenia z osobami i przy oknie 30 dni przekraczaly limit czasu HogQL API ("Query has hit
// the max execution time", zmierzone 2026-09-18: 15-110 s vs 0,6-9 s po distinct_id).
// Anonimowe zdarzenia sprzed logowania zostaja - to prawdziwy ruch.
const phInternalFilter = (ids: string[]) =>
  ids.length ? `distinct_id NOT IN (${ids.map((id) => `'${id}'`).join(",")})` : "1 = 1";
async function phRows(query: string): Promise<any[][]> {
  const r = await phQuery(query);
  return (r?.results ?? []) as any[][];
}

// ── Resend (wzorzec z monitor-user-threshold) ──
async function sendEmail(args: { resendKey: string; subject: string; html: string; to?: string[] }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "spontaway <noreply@spontaway.com>",
      to: args.to ?? ALERT_EMAILS,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error: ${res.status} ${text}`);
  }
}

// Id kont wewnetrznych - wykluczane z liczb Supabase. `column` = kolumna z id usera w danej
// tabeli (profiles.id / routes.user_id / discovery_collections.user_id).
function internalUserIds(): string[] {
  return INTERNAL_EMAILS.map((e) => INTERNAL_USER_IDS[e]).filter((id): id is string => !!id);
}
// PostgREST: `not.in.(a,b)` - uuid bez cudzyslowow jest bezpieczne (brak przecinkow/nawiasow).
const notInternal = (q: any, column: string, ids: string[]) => (ids.length ? q.not(column, "in", `(${ids.join(",")})`) : q);

// Liczba z Supabase (count exact, head - bez pobierania wierszy).
async function countRows(sb: any, table: string, build?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) { console.error(`count ${table} error:`, error.message); return 0; }
  return count ?? 0;
}

function fmtDelta(now: number, prev: number): string {
  if (prev <= 0) return "";
  const pct = Math.round(((now - prev) / prev) * 100);
  const sign = pct > 0 ? "+" : "";
  const color = pct >= 0 ? "#16a34a" : "#dc2626";
  return ` <span style="color:${color};font-size:12px;font-weight:600;">${sign}${pct}%</span>`;
}

// Proste nazwy zdarzen - czyta je founder, ktory nie zna nazw z kodu (prosba Nat 2026-09-18).
// Brak wpisu = surowa nazwa z kodu (dopisz tutaj, gdy pojawi sie nowe zdarzenie produktowe).
const EVENT_PL: Record<string, string> = {
  $pageview: "Otwarcie ekranu w aplikacji",
  $screen: "Otwarcie ekranu w aplikacji",
  explore_opened: "Wejście na Eksplorację",
  place_viewed: "Otwarcie wizytówki miejsca",
  place_saved: "Zapisanie miejsca (zakładka)",
  trip_create_opened: "Start tworzenia wyjazdu",
  trip_place_added: "Dodanie miejsca do wyjazdu",
  trip_published: "Opublikowanie wyjazdu",
  trip_places_forked: "Skopiowanie miejsc z cudzego wyjazdu",
  trip_places_copied: "Skopiowanie miejsc z cudzego wyjazdu",
  list_create_opened: "Start tworzenia kolekcji",
  collection_created: "Utworzenie kolekcji",
  list_place_added: "Dodanie miejsca do kolekcji",
  list_published: "Opublikowanie kolekcji",
  list_saved: "Zapisanie cudzej kolekcji",
  route_saved: "Zapisanie cudzego wyjazdu",
  route_liked: "Polubienie wyjazdu",
  list_liked: "Polubienie kolekcji",
  user_followed: "Zaobserwowanie użytkownika",
  content_shared: "Udostępnienie linku poza aplikację",
  referral_shared: "Wysłanie zaproszenia do aplikacji",
  notification_opened: "Otwarcie powiadomienia",
  onboarding_completed: "Ukończenie onboardingu",
  user_signed_up: "Rejestracja konta",
  user_signed_in: "Logowanie",
  cookie_consent_granted: "Zgoda na analitykę",
  cookie_consent_denied: "Odmowa zgody na analitykę",
  permission_prompt_shown: "Pytanie o zgodę (push / lokalizacja)",
  permission_prompt_result: "Odpowiedź na pytanie o zgodę",
  permission_system_result: "Decyzja w systemowym alercie zgody",
  permission_settings_shown: "Podpowiedź: włącz zgodę w Ustawieniach",
  permission_settings_result: "Reakcja na podpowiedź o Ustawieniach",
  place_added_to_route: "Dodanie miejsca do wyjazdu",
  route_created: "Utworzenie wyjazdu",
  group_session_created: "Utworzenie sesji grupowej",
  landing_waitlist_signup: "Zapis na listę oczekujących (strona)",
  landing_download_modal_open: "Kliknięcie „Pobierz aplikację” (strona)",
  landing_store_badge_click: "Kliknięcie w App Store / Google Play (strona)",
  landing_business_click: "Kliknięcie w sekcję dla lokali (strona)",
  landing_business_inquiry_open: "Otwarcie formularza dla lokali (strona)",
  landing_business_inquiry_sent: "Wysłanie zapytania od lokalu (strona)",
  landing_language_switched: "Zmiana języka (strona)",
  demo_started: "Start demo",
  demo_signup_clicked: "Demo → rejestracja",
};
// Zdarzenia techniczne SDK - nie mowia nic o produkcie, a zalewaly liste (autocapture na
// landingu, $set przy kazdym identify, $opt_in przy kazdym starcie).
const HIDDEN_EVENTS = new Set(["$autocapture", "$set", "$opt_in", "$opt_out", "$identify", "$pageleave", "$web_vitals", "$recording_observed", "$rageclick", "$feature_flag_called", "$groupidentify", "$create_alias", "$exception"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Guard: cron (x-trigger-secret z Vault, jak send-push/push-scheduler) LUB service_role.
  // verify_jwt=false -> sprawdzamy sami. Sam service_role nie wystarcza: klucz bywa rotowany i
  // nie zawsze zgadza sie z env funkcji, a cron budowal naglowek z pustego ustawienia bazy
  // (`app.settings.service_role_key`) -> lecialo "Bearer null" i 401 (naprawione 2026-09-01).
  const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
  const isTrigger = triggerSecret.length > 0 && req.headers.get("x-trigger-secret") === triggerSecret;
  const _auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isTrigger && _auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return jsonResponse({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY not set" }, 500);

  const sb = createClient(supabaseUrl, serviceRoleKey);

  // `{"dry_run": true}` = zbuduj raport i ODDAJ go w odpowiedzi, ale NIE wysylaj maila.
  // Bez tego kazde sprawdzenie zmiany w raporcie kosztuje cztery skrzynki zespolu.
  // `{"test_to": "adres@..."}` = wyslij raport TYLKO na ten adres (podglad tresci u jednej
  // osoby zamiast czterech skrzynek zespolu). Adres musi byc na liscie ALERT_EMAILS - to nie
  // jest kanal do wysylania raportu obcym.
  let dryRun = false;
  let testTo: string | null = null;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
    if (typeof body?.test_to === "string" && ALERT_EMAILS.includes(body.test_to.toLowerCase())) testTo = body.test_to.toLowerCase();
  } catch { /* brak ciala zadania = normalny przebieg */ }

  try {
    const now = Date.now();
    const since24 = new Date(now - 86_400_000).toISOString();
    const sincePrev = new Date(now - 2 * 86_400_000).toISOString();

    // Konta wewnetrzne poza kazda liczba (patrz INTERNAL_EMAILS).
    const internal = internalUserIds();

    // ── Supabase: konta ──
    const [totalAccounts, newAccounts, newAccountsPrev] = await Promise.all([
      countRows(sb, "profiles", (q) => notInternal(q, "id", internal)),
      countRows(sb, "profiles", (q) => notInternal(q, "id", internal).gte("created_at", since24)),
      countRows(sb, "profiles", (q) => notInternal(q, "id", internal).gte("created_at", sincePrev).lt("created_at", since24)),
    ]);

    // ── Supabase: wyjazdy ──
    const [totalRoutes, newRoutes, newRoutesPrev, newCompleted] = await Promise.all([
      countRows(sb, "routes", (q) => notInternal(q, "user_id", internal)),
      countRows(sb, "routes", (q) => notInternal(q, "user_id", internal).gte("created_at", since24)),
      countRows(sb, "routes", (q) => notInternal(q, "user_id", internal).gte("created_at", sincePrev).lt("created_at", since24)),
      countRows(sb, "routes", (q) => notInternal(q, "user_id", internal).gte("created_at", since24).eq("trip_type", "completed")),
    ]);

    // ── Supabase: kolekcje (kuratorskie `visited`; prywatna wishlista "Ogolne" powstaje sama
    //    przy pierwszym zapisie i nie jest decyzja usera, wiec jej nie liczymy) ──
    const collections = (q: any) => notInternal(q, "user_id", internal).eq("kind", "ranking").eq("list_status", "visited");
    const [totalCollections, newCollections, newCollectionsPrev] = await Promise.all([
      countRows(sb, "discovery_collections", (q) => collections(q)),
      countRows(sb, "discovery_collections", (q) => collections(q).gte("created_at", since24)),
      countRows(sb, "discovery_collections", (q) => collections(q).gte("created_at", sincePrev).lt("created_at", since24)),
    ]);

    // ── Aktywacja: % userów z ≥1 wyjazdem (lifetime). Skala MVP (<kilka tys.) -> dedup w JS. ──
    const { data: routeUsers } = await notInternal(sb.from("routes").select("user_id"), "user_id", internal);
    const activatedSet = new Set((routeUsers ?? []).map((r: any) => r.user_id).filter(Boolean));
    const activationPct = totalAccounts > 0 ? Math.round((activatedSet.size / totalAccounts) * 100) : 0;

    // ── PostHog: DAU/WAU/MAU + najczestsze zdarzenia 24h + kolekcje (zdarzenia produktowe) ──
    // `list_place_added` bez `general` = dopisanie do kuratorskiej kolekcji; `general: true` to
    // zapis 1-tap do prywatnej "Ogolne" (to jest osobno jako place_saved).
    // DAU/WAU/MAU jednym zapytaniem (countIf), aktywnosc kolekcji drugim - mniej round-tripow
    // do PostHoga, ktory rownoleglych zapytan nie lubi (patrz phQuery).
    const PH_NOT_INTERNAL = phInternalFilter(internal);
    const active = (await phRows(`SELECT
        uniqIf(person_id, toDate(timestamp) = today()) AS dau,
        uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS wau,
        uniq(person_id) AS mau
      FROM events WHERE timestamp >= now() - INTERVAL 30 DAY AND ${PH_NOT_INTERNAL}`))[0] ?? [];
    const [dau, wau, mau] = [Number(active[0] ?? 0), Number(active[1] ?? 0), Number(active[2] ?? 0)];
    const topEvents = await phRows(`SELECT event, count() AS c FROM events WHERE timestamp >= now() - INTERVAL 1 DAY AND ${PH_NOT_INTERNAL} GROUP BY event ORDER BY c DESC LIMIT 24`);
    const coll = (await phRows(`SELECT
        countIf(event = 'collection_created') AS created,
        countIf(event = 'list_place_added' AND coalesce(toString(properties.general), '') != 'true') AS added,
        uniqIf(person_id, event = 'list_place_added' AND coalesce(toString(properties.general), '') != 'true') AS adders
      FROM events WHERE timestamp >= now() - INTERVAL 1 DAY AND event IN ('collection_created', 'list_place_added') AND ${PH_NOT_INTERNAL}`))[0] ?? [];
    const [phCollectionsCreated, phPlacesAddedToCollections, phCollectionAdders] = [Number(coll[0] ?? 0), Number(coll[1] ?? 0), Number(coll[2] ?? 0)];

    // ── Waitlista (RPC waitlist_digest_stats - service_role only, zwraca adresy) ──
    // "Czeka" liczy TYLKO zapisy bez konta: kto sie juz zarejestrowal, ten nie czeka
    // na premiere. Ta sama zasada, co licznik w panelu ops.
    let waitlist = { waiting: 0, converted: 0, new_24h: 0, rows: [] as any[] };
    {
      const { data, error } = await sb.rpc("waitlist_digest_stats", { p_limit: 10 });
      if (error) console.error("waitlist_digest_stats error:", error.message);
      else if (data) waitlist = data as typeof waitlist;
    }

    const dateLabel = new Date(now).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "Europe/Warsaw" });
    const subject = `spontaway - raport ${dateLabel}: +${newAccounts} kont, +${newRoutes} wyjazdów, +${newCollections} kolekcji`;

    const ACCENT = "#F9662B";
    const card = (label: string, value: string, sub = "") => `
      <td style="padding:14px 16px;background:#fafafa;border:1px solid #eee;border-radius:14px;vertical-align:top;">
        <div style="font-size:12px;color:#979797;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">${label}</div>
        <div style="font-size:24px;font-weight:800;color:#0E0E0E;margin-top:2px;">${value}</div>
        ${sub ? `<div style="font-size:12px;color:#979797;margin-top:2px;">${sub}</div>` : ""}
      </td>`;

    // Zdarzenia techniczne wypadaja, zostaje 10 produktowych. Nazwa z kodu tylko szarym
    // drobnym drukiem - founder czyta prosta nazwe, dev ma po czym szukac w PostHogu.
    const eventsRows = (topEvents ?? [])
      .filter((row) => !HIDDEN_EVENTS.has(String(row[0])))
      .slice(0, 10)
      .map((row, i) => {
        const ev = String(row[0]);
        const c = Number(row[1] ?? 0);
        const label = EVENT_PL[ev] ?? ev;
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#979797;font-size:13px;width:28px;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#0E0E0E;">${label}${label !== ev ? ` <span style="color:#cfcfcf;font-size:11px;">${ev}</span>` : ""}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;text-align:right;">${c}</td>
        </tr>`;
      })
      .join("");

    const waitlistRows = (waitlist.rows ?? [])
      .map((r: any) => {
        const when = new Date(r.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "Europe/Warsaw" });
        const badge = r.is_new
          ? ` <span style="background:#FDF184;color:#5B2C06;font-size:11px;font-weight:700;padding:1px 6px;border-radius:999px;">nowy</span>`
          : "";
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#0E0E0E;">${r.email}${badge}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#979797;text-align:right;white-space:nowrap;">${when} · ${r.source ?? "-"}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#FEFEFE;padding:8px;">
        <h1 style="font-size:20px;color:${ACCENT};margin:8px 4px 2px;">spontaway - dzienny raport</h1>
        <p style="font-size:13px;color:#979797;margin:0 4px 16px;">Dane z ostatnich 24h. Wygenerowano ${new Date(now).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} (Europe/Warsaw).</p>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Konta</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Nowe konta (24h)", `+${newAccounts}${fmtDelta(newAccounts, newAccountsPrev)}`)}
          ${card("Łącznie kont", String(totalAccounts))}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Wyjazdy</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Nowe wyjazdy (24h)", `+${newRoutes}${fmtDelta(newRoutes, newRoutesPrev)}`, `w tym ${newCompleted} ukończonych`)}
          ${card("Łącznie wyjazdów", String(totalRoutes))}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Kolekcje miejsc</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Nowe kolekcje (24h)", `+${newCollections}${fmtDelta(newCollections, newCollectionsPrev)}`, `PostHog: ${phCollectionsCreated} utworzonych`)}
          ${card("Łącznie kolekcji", String(totalCollections))}
        </tr><tr style="height:8px;"></tr><tr>
          ${card("Miejsca dodane do kolekcji (24h)", String(phPlacesAddedToCollections), "do już istniejących kolekcji")}
          ${card("Kto dodawał", String(phCollectionAdders), "osób, które dodały miejsce")}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Aktywacja i retencja</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Aktywacja", `${activationPct}%`, `${activatedSet.size}/${totalAccounts} z ≥1 wyjazdem`)}
          ${card("DAU", String(dau), "aktywni dziś")}
        </tr><tr style="height:8px;"></tr><tr>
          ${card("WAU", String(wau), "aktywni 7 dni")}
          ${card("MAU", String(mau), "aktywni 30 dni")}
        </tr></table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Waitlista</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;"><tr>
          ${card("Czeka na premierę", String(waitlist.waiting), waitlist.new_24h > 0 ? `+${waitlist.new_24h} w ciągu doby` : "bez zmian w ciągu doby")}
          ${card("Ma już konto", String(waitlist.converted), "nie liczą się do czekających")}
        </tr></table>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:12px;overflow:hidden;margin-top:8px;">
          ${waitlistRows || `<tr><td style="padding:12px;color:#979797;font-size:13px;">Nikt nie czeka - każdy zapisany ma już konto.</td></tr>`}
        </table>

        <h2 style="font-size:14px;color:#0E0E0E;margin:18px 4px 8px;">Co użytkownicy robili najczęściej (24h)</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          ${eventsRows || `<tr><td style="padding:12px;color:#979797;font-size:13px;">Brak zdarzeń w tym oknie.</td></tr>`}
        </table>

        <p style="font-size:11px;color:#cfcfcf;margin:24px 4px 8px;">Konta, wyjazdy i kolekcje: Supabase (źródło prawdy). DAU/WAU/MAU i zdarzenia: PostHog. Konta zespołu (${INTERNAL_EMAILS.join(", ")}) są wyłączone ze wszystkich liczb. Raport automatyczny, codziennie ~9:00.</p>
      </div>`;

    if (dryRun) {
      return jsonResponse({
        sent: false,
        dry_run: true,
        subject,
        waitlist,
        summary: { newAccounts, totalAccounts, newRoutes, totalRoutes, newCompleted, newCollections, totalCollections, phCollectionsCreated, phPlacesAddedToCollections, phCollectionAdders, activationPct, dau, wau, mau, topEvents: (topEvents ?? []).length, internalExcluded: internal.length },
        html,
      });
    }

    await sendEmail({ resendKey, subject: testTo ? `[TEST] ${subject}` : subject, html, to: testTo ? [testTo] : undefined });

    return jsonResponse({
      sent: true,
      to: testTo ? [testTo] : ALERT_EMAILS,
      summary: {
        newAccounts, totalAccounts, newRoutes, totalRoutes, newCompleted, newCollections, totalCollections,
        phCollectionsCreated, phPlacesAddedToCollections, phCollectionAdders, activationPct, dau, wau, mau,
        topEvents: (topEvents ?? []).length, internalExcluded: internal.length,
        waitlistWaiting: waitlist.waiting, waitlistNew24h: waitlist.new_24h, waitlistConverted: waitlist.converted,
      },
    });
  } catch (err) {
    console.error("[daily-analytics-digest] failed:", String(err));
    return jsonResponse({ error: String(err) }, 500);
  }
});
