export const config = { runtime: "edge" };

// PODGLAD LINKU (Open Graph) dla wyjazdu i listy - to, co widac po wklejeniu linku w Messengerze,
// iMessage czy na Instagramie (prosba Nat 2026-09-01, ze screenem z Pinteresta).
//
// Dlaczego to musi byc funkcja serwerowa: aplikacja chodzi na trasach z hashem
// (spontaway.com/#/route/<id>), a wszystko po "#" NIGDY nie trafia na serwer. Robot Facebooka
// dostawal wiec goly index.html i pokazywal ten sam ogolny baner marki dla kazdego linku.
// Ten endpoint zwraca HTML z tagami OG danego wyjazdu/listy i dopiero potem przerzuca
// czlowieka do aplikacji. Robot czyta tagi i nie wykonuje przekierowania - dostaje wiec
// okladke i tytul, a user i tak lada w apce.
//
// Adresy: /r/<id> (wyjazd) i /l/<id> (lista) - przepisane na ten endpoint w vercel.json.

const SUPA = process.env.VITE_SUPABASE_URL || "https://api.trasa.travel";
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU";
const SITE = "https://spontaway.com";
const FALLBACK_IMG = `${SITE}/baner-ios.png`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function rest(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!r.ok) return [];
    return (await r.json()) as any[];
  } catch { return []; }
}

// Zdjecie do podgladu MUSI byc bezwzglednym adresem https - robot nie ma kontekstu strony.
// Sciezki wzgledne dostaja domene, referencja Google idzie przez nasze proxy zdjec, a Storage
// dostaje transformacje do 1200x630 (proporcja podgladu w komunikatorach).
function absImage(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_IMG;
  if (raw.startsWith("/")) return SITE + raw;
  if (!/^https?:/i.test(raw)) return `${SITE}/api/place-photo?ref=${encodeURIComponent(raw)}&w=1200`;
  if (raw.includes("/storage/v1/object/public/")) {
    const t = raw.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    return `${t}${t.includes("?") ? "&" : "?"}width=1200&height=630&resize=cover&quality=80`;
  }
  return raw;
}

const plural = (n: number) => (n === 1 ? "miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "miejsca" : "miejsc");

function page(o: { title: string; desc: string; image: string; url: string; target: string }) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta property="og:site_name" content="spontaway">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${esc(o.image)}">
<meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(o.image)}">
<meta http-equiv="refresh" content="0; url=${esc(o.target)}">
</head><body style="font-family:-apple-system,sans-serif;background:#FEFEFE;color:#0E0E0E;padding:32px">
<p>Otwieram w spontaway…</p>
<p><a href="${esc(o.target)}">Przejdź dalej</a></p>
<script>location.replace(${JSON.stringify(o.target)});</script>
</body></html>`;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("t");
  const id = searchParams.get("id") ?? "";

  const isList = kind === "list";
  const target = `${SITE}/#/${isList ? "lista" : "route"}/${id}`;
  const url = `${SITE}/${isList ? "l" : "r"}/${id}`;
  let title = "spontaway - odkrywaj miejsca, planuj podróże";
  let desc = "Przeglądaj miejsca, twórz trasy i planuj wyjazdy ze znajomymi.";
  let image = FALLBACK_IMG;

  if (UUID.test(id)) {
    if (isList) {
      const [col] = await rest(`discovery_collections?id=eq.${id}&select=title,city,description,cover_url,list_cover_url&limit=1`);
      if (col) {
        // Dla LISTY najwazniejsza jest NAZWA - to ona sprzedaje klikniecie ("Gdzie na wege Warszawa").
        title = col.title || "Lista miejsc";
        const items = await rest(`discovery_items?collection_id=eq.${id}&select=id&order=order_index.asc&limit=12`);
        const n = items.length;
        desc = col.description || [col.city, n ? `${n} ${plural(n)}` : null].filter(Boolean).join(" · ") || "Lista miejsc w spontaway";
        // Obrazek zostaje MARKOWY (decyzja Nat 2026-09-01). Lista to zbior wielu miejsc - jedno
        // wyrwane zdjecie zapowiada cos innego, niz user dostanie po klikinieciu, a czesto jest
        // to zdjecie przypadkowego lokalu. Nazwa niesie tu cala tresc, wiec obrazek ma tylko
        // powiedziec "to jest spontaway". Wyjazd zostaje przy wlasnej okladce - tam obrazek JEST
        // trescia (jedno miejsce, jedna pocztowka).
      }
    } else {
      const [route] = await rest(`routes?id=eq.${id}&select=title,city,description,cover_url,list_cover_url&limit=1`);
      if (route) {
        // Dla WYJAZDU najwazniejsza jest OKLADKA - podglad ma wygladac jak pocztowka.
        title = route.title || (route.city ? `Wyjazd do ${route.city}` : "Wyjazd");
        const pins = await rest(`pins?route_id=eq.${id}&select=user_photo_urls&limit=30`);
        const n = pins.length;
        desc = route.description || [route.city, n ? `${n} ${plural(n)}` : null].filter(Boolean).join(" · ") || "Wyjazd w spontaway";
        image = absImage(route.list_cover_url || route.cover_url);
      }
    }
  }

  return new Response(page({ title, desc, image, url, target }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Podglady sa cache'owane po stronie komunikatorow; my trzymamy krotki cache brzegowy,
      // zeby zmiana okladki byla widoczna bez czekania na wygasniecie.
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
