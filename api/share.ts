export const config = { runtime: "edge" };

// PUBLICZNA STRONA WYJAZDU / LISTY - to, co widzi osoba, ktora dostala link i NIE MA aplikacji.
//
// Skad sie wziela: adres z hashem (spontaway.com/#/route/<id>) nigdy nie dociera na serwer, wiec
// robot komunikatora dostawal goly index.html (ten sam baner marki dla kazdego linku), a czlowiek
// - bramke waitlisty, czyli nic. Link byl bezuzyteczny w obie strony.
//
// Ten endpoint obsluguje krotkie adresy /r/<id> (wyjazd) i /l/<id> (lista) i robi dwie rzeczy:
//  1. TAGI OG - podglad w Messengerze, iMessage, na Instagramie.
//  2. STRONE - wyrenderowana lista miejsc / plan wyjazdu, czytelna bez aplikacji, z CTA na gorze.
// Zadnego przekierowania: to jest docelowa strona linku. Wczesniej byl tu redirect do apki, ale
// bez universal links i tak nikogo do niej nie wprowadzal - tylko wyrzucal na waitliste.
//
// Widoczne jest WYLACZNIE to, co przepuszcza RLS dla klucza anonimowego (lista publiczna i
// zatwierdzona, opublikowana trasa). Lista prywatna ("Ogolne") zwraca pusto -> strona "niedostepna".

const SUPA = process.env.VITE_SUPABASE_URL || "https://api.trasa.travel";
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU";
const SITE = "https://spontaway.com";
// Znak marki = ikona aplikacji (zlotawy gradient + pomaranczowe "S"), ta sama, ktora user widzi
// na ekranie telefonu. public/spontaway-logo.png to kopia mastera "App icon IOS.png" pod nazwa
// bez spacji (spacje w URL-u to proszenie sie o klopoty w robotach komunikatorow).
const BRAND_IMG = `${SITE}/spontaway-logo.png`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CTA na gorze i na dole strony. DOPOKI aplikacji nie ma w App Store, prowadzi na zapisy na
// premiere. Po wydaniu wystarczy wpisac tu adres z App Store - reszta strony sie nie zmienia.
const APP_STORE_URL: string | null = null;
const CTA_READY = !!APP_STORE_URL;
const CTA_LABEL = "Pobierz w App Store";
// Dopoki aplikacji nie ma w sklepie, guzik jest WYSZARZONY i nieklikalny, z dopiskiem "wkrotce"
// (decyzja Nat 2026-09-01). Obiecuje to, co bedzie, zamiast prowadzic na zapisy - odbiorca linku
// widzi konkret ("bede mogl to pobrac"), a nie kolejny formularz. Po wydaniu wystarczy wpisac
// adres w APP_STORE_URL: guzik sam staje sie aktywnym, pomaranczowym linkiem.
// OFICJALNA plakietka Apple (public/Pobierz-z-App-Store.png, wersja polska) - wytyczne Apple nie
// pozwalaja rysowac wlasnego guzika "App Store". Do czasu premiery jest wygaszona (odbarwiona +
// polprzezroczysta) i nieklikalna, z dopiskiem "wkrotce"; po wpisaniu APP_STORE_URL wraca do
// pelnego koloru i staje sie linkiem, czyli do postaci zgodnej z wytycznymi.
const BADGE = `${SITE}/Pobierz-z-App-Store.png`;
const ctaTop = () => CTA_READY
  ? `<a class="badge" href="${esc(APP_STORE_URL!)}"><img src="${BADGE}" alt="${CTA_LABEL}"></a>`
  : `<span class="badge off" title="Dostępne wkrótce"><img src="${BADGE}" alt="${CTA_LABEL}"><i>wkrótce</i></span>`;
const ctaBig = () => CTA_READY
  ? `<a class="badge big" href="${esc(APP_STORE_URL!)}"><img src="${BADGE}" alt="${CTA_LABEL}"></a>`
  : `<span class="badge big off"><img src="${BADGE}" alt="${CTA_LABEL}"></span><p class="soon">Dostępne wkrótce</p>`;

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function rest(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (!r.ok) return [];
    return (await r.json()) as any[];
  } catch { return []; }
}

const first = (v: any): string | null => (Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null);

// Zdjecia musza byc bezwzglednymi adresami https (robot nie ma kontekstu strony). Storage dostaje
// transformacje do zadanej szerokosci - miniatura 160 px zamiast oryginalu ~2,4 MB.
function img(raw: string | null | undefined, w: number, h?: number): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) return SITE + raw;
  if (!/^https?:/i.test(raw)) return `${SITE}/api/place-photo?ref=${encodeURIComponent(raw)}&w=${w}`;
  if (raw.includes("/storage/v1/object/public/")) {
    const t = raw.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    const size = h ? `width=${w}&height=${h}&resize=cover` : `width=${w}`;
    return `${t}${t.includes("?") ? "&" : "?"}${size}&quality=75`;
  }
  return raw;
}

// Ikona kategorii - ten sam zestaw plikow co w aplikacji (public/Ikona__*.svg, kolor #ef9d78).
// Skrocona mapa: tylko kategorie, ktore realnie wystepuja w danych; reszta dostaje sam kolor tla.
const CATEGORY_ICON: Record<string, string> = {
  restaurant: "Restauracja-18", cafe: "Kawiarnia", bar: "Bar", club: "Bar", nightclub: "Bar",
  bakery: "Piekarnia", pastry: "Cukiernia", dessert: "Cukiernia",
  museum: "Landmark", monument: "Landmark", church: "Landmark", landmark: "Landmark",
  gallery: "Sztuka", art: "Sztuka", theater: "Sztuka", cinema: "Sztuka",
  park: "Natura", garden: "Natura", nature: "Natura", walk: "Natura",
  shop: "Zakupy", store: "Zakupy", shopping: "Zakupy",
};
const iconFor = (c: string | null | undefined) => {
  const f = c ? CATEGORY_ICON[c.toLowerCase()] : null;
  return f ? `${SITE}/Ikona__${f}.svg` : null;
};

// Klucz zdjec spolecznosci (place_photos) - format 1:1 z aplikacja (placeKeyOf).
const placeKey = (gpid: string | null | undefined, name: string | null | undefined) =>
  gpid ? `gpid:${gpid}` : `nm:${(name ?? "").trim().toLowerCase()}`;

// Zdjecia miejsc dodane przez userow. W aplikacji kafelek bez wlasnego zdjecia siega wlasnie tu,
// wiec strona publiczna robi to samo - inaczej lista wygladalaby na pusta, choc zdjecia sa.
async function communityPhotos(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(keys.filter(Boolean))].slice(0, 60);
  if (!uniq.length) return map;
  const inList = uniq.map((k) => `"${k.replace(/"/g, '')}"`).join(",");
  const rows = await rest(`place_photos?place_key=in.(${encodeURIComponent(inList)})&select=place_key,photo_url`);
  for (const r of rows) if (r.photo_url && !map.has(r.place_key)) map.set(r.place_key, r.photo_url);
  return map;
}

const plural = (n: number) => (n === 1 ? "miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "miejsca" : "miejsc");

const CATEGORY_PL: Record<string, string> = {
  cafe: "Kawiarnia", restaurant: "Restauracja", bar: "Bar", pub: "Pub", bakery: "Piekarnia",
  landmark: "Zabytek", museum: "Muzeum", park: "Park", gallery: "Galeria", shop: "Sklep",
  store: "Sklep", hotel: "Nocleg", beach: "Plaża", viewpoint: "Punkt widokowy", club: "Klub",
};
const catLabel = (c: string | null | undefined) =>
  !c ? "" : CATEGORY_PL[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1);

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#FEFEFE;color:#0E0E0E;font:16px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:0 20px 96px}
.bar{position:sticky;top:0;z-index:10;background:rgba(254,254,254,.94);backdrop-filter:blur(12px);border-bottom:1px solid #eee}
.bar .in{max-width:560px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:10px}
.mark{width:28px;height:28px;flex:none;border-radius:7px;display:block}
.brand{font-weight:800;letter-spacing:-.01em}
.badge{margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none}
.badge img{height:34px;width:auto;display:block}
.badge.off img{filter:grayscale(1);opacity:.4}
.badge.off i{font-size:9px;font-style:normal;letter-spacing:.06em;text-transform:uppercase;color:#9A9A9A}
.badge.big{margin:0}
.badge.big img{height:50px}
.eyebrow{margin:28px 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#C58A66}
h1{margin:0;font-size:30px;line-height:1.1;font-weight:900;letter-spacing:-.02em;text-wrap:balance}
.meta{margin:10px 0 0;color:#979797;font-size:14px}
.author{display:flex;align-items:center;gap:8px;margin:14px 0 0}
.author img{width:28px;height:28px;border-radius:50%;object-fit:cover;background:#fcede3}
.author span{font-size:14px;font-weight:600}
.cover{margin:20px 0 0;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:20px;background:#fcede3;display:block}
.desc{margin:16px 0 0;color:#4b4b4b;font-size:15px}
ul{list-style:none;margin:26px 0 0;padding:0}
li{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f1f1;align-items:flex-start}
li:last-child{border-bottom:0}
.thumb{width:64px;height:64px;flex:none;border-radius:16px;object-fit:cover;background:#F6D9C6}
.ph{width:64px;height:64px;flex:none;border-radius:16px;background:#F6D9C6;display:flex;align-items:center;justify-content:center}
.ph img{width:28px;height:28px;opacity:.9}
.num{width:26px;height:26px;flex:none;border-radius:50%;background:#ea580c;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:19px}
.nm{font-weight:700;font-size:16px;line-height:1.25}
.ct{color:#979797;font-size:13px;margin-top:2px}
.note{margin:6px 0 0;font-size:14px;color:#4b4b4b;background:#f6f6f6;border-radius:14px;padding:8px 11px}
.foot{margin:36px 0 0;background:#FCEDE3;border-radius:24px;padding:24px;text-align:center}
.foot p{margin:0 0 16px;font-size:15px;color:#5C4136}
.foot .badge{display:inline-flex}
.foot .soon{margin:10px 0 0;font-size:13px;color:#9A8578}
.empty{padding:80px 0;text-align:center}
.empty .mark{width:76px;height:76px;border-radius:18px;margin:0 auto 18px}
`;

function shell(o: { title: string; desc: string; image: string; url: string; body: string; noun?: string }) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)} · spontaway</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="noindex">
<meta property="og:site_name" content="spontaway"><meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${esc(o.image)}"><meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(o.image)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="bar"><div class="in"><img class="mark" src="${BRAND_IMG}" alt=""><span class="brand">spontaway</span>
${ctaTop()}</div></div>
<div class="wrap">${o.body}
<div class="foot"><p>${o.noun === "route" ? "Ten wyjazd powstał w spontaway" : o.noun === "list" ? "Ta lista powstała w spontaway" : "spontaway to aplikacja"} - do odkrywania miejsc i planowania wyjazdów ze znajomymi.</p>
${ctaBig()}</div></div>
</body></html>`;
}

function row(o: { photo: string | null; icon?: string | null; name: string; cat: string; note?: string | null; num?: number }) {
  return `<li>${o.num ? `<span class="num">${o.num}</span>` : ""}
${o.photo ? `<img class="thumb" src="${esc(o.photo)}" alt="" loading="lazy">`
    : o.icon ? `<span class="ph"><img src="${esc(o.icon)}" alt="" loading="lazy"></span>` : `<span class="ph"></span>`}
<div><div class="nm">${esc(o.name)}</div>${o.cat ? `<div class="ct">${esc(o.cat)}</div>` : ""}
${o.note ? `<p class="note">${esc(o.note)}</p>` : ""}</div></li>`;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const isList = searchParams.get("t") === "list";
  const id = searchParams.get("id") ?? "";
  const url = `${SITE}/${isList ? "l" : "r"}/${id}`;

  const missing = () => new Response(shell({
    title: "Treść niedostępna", desc: "Ta treść mogła zostać usunięta lub jest prywatna.", image: BRAND_IMG, url,
    body: `<div class="empty"><img class="mark" src="${BRAND_IMG}" alt=""><h1>Treść niedostępna</h1>
<p class="meta">Mogła zostać usunięta albo jest prywatna.</p></div>`,
  }), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!UUID.test(id)) return missing();

  if (isList) {
    const [col] = await rest(`discovery_collections?id=eq.${id}&select=title,city,description,user_id&limit=1`);
    if (!col) return missing();
    const items = await rest(`discovery_items?collection_id=eq.${id}&select=place_name,category,short_desc,photo_url,images,google_place_id&order=order_index.asc&limit=60`);
    const photos = await communityPhotos(items.map((it) => placeKey(it.google_place_id, it.place_name)));
    const [author] = col.user_id ? await rest(`profiles?id=eq.${col.user_id}&select=username,avatar_url&limit=1`) : [];
    const title = col.title || "Lista miejsc";
    const desc = col.description || [col.city, items.length ? `${items.length} ${plural(items.length)}` : null].filter(Boolean).join(" · ");
    const body = `<p class="eyebrow">LISTA MIEJSC</p><h1>${esc(title)}</h1>
<p class="meta">${esc([col.city, `${items.length} ${plural(items.length)}`].filter(Boolean).join(" · "))}</p>
${author?.username ? `<div class="author"><img src="${esc(img(author.avatar_url, 64, 64) ?? "")}" alt=""><span>@${esc(author.username)}</span></div>` : ""}
${col.description ? `<p class="desc">${esc(col.description)}</p>` : ""}
<ul>${items.map((it) => row({
      photo: img(it.photo_url || first(it.images) || photos.get(placeKey(it.google_place_id, it.place_name)), 160, 160),
      icon: iconFor(it.category), name: it.place_name || "", cat: catLabel(it.category), note: it.short_desc,
    })).join("")}</ul>`;
    // Obrazek podgladu dla LISTY zostaje markowy - patrz decyzja przy udostepnianiu.
    return new Response(shell({ title, desc, image: BRAND_IMG, url, body, noun: "list" }), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  }

  const [route] = await rest(`routes?id=eq.${id}&select=title,city,description,cover_url,list_cover_url,user_id&limit=1`);
  if (!route) return missing();
  const pins = await rest(`pins?route_id=eq.${id}&select=place_name,category,images,user_photo_urls,image_url,photo_url,pin_order,place_id&order=pin_order.asc&limit=80`);
  const pinPhotos = await communityPhotos(pins.map((p) => placeKey(null, p.place_name)));
  const [author] = route.user_id ? await rest(`profiles?id=eq.${route.user_id}&select=username,avatar_url&limit=1`) : [];
  const title = route.title || (route.city ? `Wyjazd do ${route.city}` : "Wyjazd");
  const desc = route.description || [route.city, pins.length ? `${pins.length} ${plural(pins.length)}` : null].filter(Boolean).join(" · ");
  const cover = img(route.list_cover_url || route.cover_url, 1200, 630);
  const body = `<p class="eyebrow">WYJAZD</p><h1>${esc(title)}</h1>
<p class="meta">${esc([route.city, `${pins.length} ${plural(pins.length)}`].filter(Boolean).join(" · "))}</p>
${author?.username ? `<div class="author"><img src="${esc(img(author.avatar_url, 64, 64) ?? "")}" alt=""><span>@${esc(author.username)}</span></div>` : ""}
${cover ? `<img class="cover" src="${esc(cover)}" alt="" loading="lazy">` : ""}
${route.description ? `<p class="desc">${esc(route.description)}</p>` : ""}
<ul>${pins.map((p, i) => row({
    photo: img(p.image_url || first(p.images) || first(p.user_photo_urls) || p.photo_url || pinPhotos.get(placeKey(null, p.place_name)), 160, 160),
    icon: iconFor(p.category), name: p.place_name || "", cat: catLabel(p.category), num: i + 1,
  })).join("")}</ul>`;
  return new Response(shell({ title, desc, image: cover ?? BRAND_IMG, url, body, noun: "route" }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
  });
}
