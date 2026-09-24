// BEZPIECZNIK KOSZTOWY publicznych proxy obrazkow (audyt naduzyc 2026-09-24).
//
// `/api/place-photo` i `/api/static-map` wolaja PLATNE API Google i sa dostepne dla kazdego,
// kto podejrzy adres w aplikacji. Bez limitu wystarczy petla zmieniajaca jeden parametr
// (inne `w`, inne wspolrzedne), zeby ominac CDN i generowac nowe platne wywolania -
// przy 10 zadaniach na sekunde to ~860 tys. wywolan na dobe i rachunek rzedu tysiecy zlotych.
//
// Licznik trzyma baza (RPC `try_consume_edge_quota`, migracja 20260924d), bo funkcja brzegowa
// nie ma wlasnej pamieci miedzy zadaniami - a nawet gdyby miala, Vercel trzyma wiele instancji
// naraz i kazda liczylaby osobno.
//
// DWA LICZNIKI, kazdy o czym innym:
//  - NA IP (godzina) - odcina jedna osobe z petla, nie ruszajac reszty swiata,
//  - GLOBALNY (doba) - twardy sufit rachunku, gdyby zadania szly z wielu adresow.
//
// ⚠️ Blad sieci/bazy = PRZEPUSZCZAMY (fail-open). Limit ma chronic przed naduzyciem, a nie
// gasic zdjecia przy kazdym drgnieciu infrastruktury; realna obrona to licznik na IP, ktory
// przy awarii i tak nie zniknie na dlugo.
//
// DWIE DROGI DO LICZNIKA, w kolejnosci sily:
//  1. KLUCZ SERWISOWY (`SUPABASE_SERVICE_ROLE_KEY` w zmiennych Vercela) - wtedy wolamy
//     `try_consume_rate_limit`, ktory jest WYLACZNIE dla service_role. Z zewnatrz nie da sie
//     go tknac, wiec nie da sie ani ominac limitu, ani nabic go nam na zlosc.
//  2. Zapasowo: klucz ANON + TOKEN (nizej). Dziala tak samo dla kosztow, ale token zyje
//     w kodzie serwerowym - kto by go wydobyl, moglby podbic nasz licznik i zgasic obrazki.
// ⛔ Klucza serwisowego NIE WOLNO uzyc nigdzie, gdzie odpowiedz wraca do przegladarki -
// tutaj sluzy wylacznie do policzenia zadania i nigdy nie opuszcza funkcji brzegowej.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ⛔ ZADNYCH SEKRETOW W TYM PLIKU (wyciek zgloszony przez skaner GitHuba, 2026-09-24).
// Stal tu TOKEN chroniacy licznik przed nabijaniem z zewnatrz - przy zalozeniu, ze katalog
// `api/` to kod serwerowy. Jest, ale trafia tez do REPOZYTORIUM: sekret w kodzie jest
// sekretem tylko do pierwszego `git push`. Token zostal uniewazniony w bazie (migracja
// 20260924h), a mocna wersja licznika idzie KLUCZEM SERWISOWYM ze zmiennych srodowiskowych.

// ⚠️ Te same stale, co w api/share.ts - razem z ZAPASOWYM kluczem anon. Zmiennych `VITE_*`
// nie ma w srodowisku funkcji brzegowych Vercela (dlatego share.ts od poczatku ma zapas),
// a bez klucza ten modul przepuszczalby WSZYSTKO po cichu: pierwsza wersja nie ruszyla ani
// jednego licznika na prodzie i wygladalo, jakby limit dzialal. Klucz anon jest publiczny
// z definicji - siedzi w paczce przegladarki.
const SUPA = process.env.VITE_SUPABASE_URL || "https://api.spontaway.com";
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU";

export type EdgeQuotaKind = "photo" | "map";

// Limity dobrane pod REALNE uzycie, ktore jest dzis bliskie zeru: zdjec Google nie pokazujemy
// w aplikacji od 2026-09-15, a mini-mapy z okladek zniknely 2026-09-23. Zostaly: panel ops
// i stary przeplyw webowy. Gdyby ktores wrocilo do aplikacji, te liczby trzeba podniesc
// SWIADOMIE - razem z decyzja o koszcie.
const LIMITS: Record<EdgeQuotaKind, { perIpHour: number; perDay: number }> = {
  // 7 $/1000 przy 1000 darmowych miesiecznie. 400/dobe = ~2,8 $ w najgorszym razie.
  photo: { perIpHour: 60, perDay: 400 },
  // 2 $/1000 przy 10 000 darmowych miesiecznie. 2000/dobe = ~4 $ w najgorszym razie.
  map: { perIpHour: 200, perDay: 2000 },
};

function callerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || req.headers.get("x-real-ip") || "unknown").slice(0, 45);
}

async function consume(bucket: string, limit: number, windowMinutes: number): Promise<boolean> {
  const key = SERVICE_KEY || ANON;
  if (!key) return true;                          // brak konfiguracji - nie blokujemy
  // Z kluczem serwisowym idziemy do funkcji zamknietej dla swiata; bez niego do tej z tokenem.
  const fn = SERVICE_KEY ? "try_consume_rate_limit" : "try_consume_edge_quota";
  const payload = SERVICE_KEY
    ? { p_bucket: `edge:${bucket}`, p_limit: limit, p_window_minutes: windowMinutes }
    : { p_bucket: bucket, p_limit: limit, p_window_minutes: windowMinutes };
  try {
    const res = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return true;                     // fail-open, patrz naglowek pliku
    return (await res.json()) !== false;
  } catch {
    return true;
  }
}

/** `true` = wolno wolac Google. `false` = limit wyczerpany (oddaj 429 i NIE wolaj). */
export async function allowEdgeCall(kind: EdgeQuotaKind, req: Request): Promise<boolean> {
  const { perIpHour, perDay } = LIMITS[kind];
  // Najpierw IP: najczestszy przypadek naduzycia to jedna osoba z petla, a wtedy globalny
  // licznik nie ma prawa sie ruszyc.
  if (!(await consume(`${kind}:ip:${callerIp(req)}`, perIpHour, 60))) return false;
  return await consume(`${kind}:day`, perDay, 1440);
}

/** Odpowiedz przy wyczerpanym limicie - lekka, bez tresci obrazka. */
export function quotaExceeded(): Response {
  return new Response("Rate limit exceeded", {
    status: 429,
    headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
  });
}
