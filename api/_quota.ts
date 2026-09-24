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
// ⛔ TOKEN zyje w kodzie SERWEROWYM (katalog api/ nie trafia do paczki przegladarki). Chroni
// wylacznie przed nabijaniem NASZEGO licznika z zewnatrz - gdyby ktos mogl wolac RPC bez tokenu,
// zablokowalby nam obrazki jednym skryptem.
const QUOTA_TOKEN = "P24k23k7po8533LbqL_Z8T2TUEHwjv60";

const SUPA = process.env.VITE_SUPABASE_URL || "https://api.spontaway.com";
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";

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
  if (!ANON) return true;                         // brak konfiguracji - nie blokujemy
  try {
    const res = await fetch(`${SUPA}/rest/v1/rpc/try_consume_edge_quota`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: QUOTA_TOKEN, p_bucket: bucket, p_limit: limit, p_window_minutes: windowMinutes }),
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
