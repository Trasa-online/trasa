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

const SUPA = process.env.VITE_SUPABASE_URL || "https://api.spontaway.com";
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
// Zapisy na testy przedpremierowe. Ten sam adres, co w pasku instalacji w aplikacji
// (src/components/share/PreReleaseBanner.tsx) - jedno miejsce prawdy dla obu.
const TESTFLIGHT_URL = "https://testflight.apple.com/join/a9rtGFuq";
// Symbol marki (samo pomaranczowe "S" na przezroczystym tle) - do kafelka w pasku instalacji.
const SYMBOL_IMG = `${SITE}/spontaway-symbol.png`;
// Obrazek podgladu linku dla LISTY (i dla wyjazdu bez okladki): baner marki 1800x945, czyli
// dokladnie proporcja, ktorej oczekuja komunikatory (~1,91:1). Kwadratowa ikona aplikacji
// pokazywala sie tam jako maly kafelek z boku, a nie jako karta - stad "brakuje miniaturek"
// przy listach (zgloszenie Nat 2026-09-09).
const OG_BANNER = { url: `${SITE}/baner-ios.png`, w: 1800, h: 945 };
const ctaTop = () => CTA_READY
  ? `<a class="badge" href="${esc(APP_STORE_URL!)}"><img src="${BADGE}" alt="${CTA_LABEL}"></a>`
  : `<span class="badge off" title="Dostępne wkrótce"><img src="${BADGE}" alt="${CTA_LABEL}"></span>`;
const ctaBig = () => CTA_READY
  ? `<a class="badge big" href="${esc(APP_STORE_URL!)}"><img src="${BADGE}" alt="${CTA_LABEL}"></a>`
  : `<span class="badge big off"><img src="${BADGE}" alt="${CTA_LABEL}"></span><p class="soon">Dostępne wkrótce</p>`;

/**
 * Wymiary obrazka odczytane z NAGLOWKA pliku (JPEG SOF / PNG IHDR), bez pobierania calosci.
 *
 * Po co: Facebook i Messenger pokazuja obrazek przy PIERWSZYM udostepnieniu tylko wtedy, gdy
 * strona podaje `og:image:width` i `og:image:height`. Bez nich musza najpierw sciagnac plik,
 * a do tego czasu link idzie BEZ miniaturki - i tak zostaje w ich cache. Dokladnie to sie stalo,
 * gdy Nat zmienila okladke wyjazdu: nowy adres obrazka, ktorego robot nigdy nie widzial
 * (zgloszenie 2026-09-09).
 *
 * Pobieramy tylko pierwsze 64 kB (naglowek `Range`), wiec koszt jest znikomy - a i tak placimy
 * go WYLACZNIE dla robotow (patrz `isCrawler`), nie dla ludzi.
 */
async function imageSize(url: string): Promise<{ w: number; h: number } | null> {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    // PNG: 8 bajtow sygnatury + naglowek IHDR (szerokosc i wysokosc jako big-endian uint32).
    if (b[0] === 0x89 && b[1] === 0x50) {
      const dv = new DataView(b.buffer, b.byteOffset);
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    // JPEG: przechodzimy po segmentach do ramki SOF (0xC0-0xCF, bez 0xC4/0xC8/0xCC).
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
        }
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
    }
    return null;
  } catch { return null; }
}

/** Czy to robot budujacy podglad linku (Messenger, WhatsApp, Slack, Telegram, Discord, X). */
const isCrawler = (req: Request) =>
  /facebookexternalhit|facebookcatalog|Twitterbot|WhatsApp|Slackbot|TelegramBot|Discordbot|LinkedInBot|Pinterest|SkypeUriPreview|redditbot|Googlebot|bingbot/i
    .test(req.headers.get("user-agent") ?? "");

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function rest(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (!r.ok) return [];
    return (await r.json()) as any[];
  } catch { return []; }
}

const first = (v: any): string | null => (Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null);

// Zdjecia musza byc bezwzglednymi adresami https (robot nie ma kontekstu strony).
//
// Male kadry (awatar, kafelek miejsca) biora MINIATURE zapisana obok pliku przy wgrywaniu -
// `<sciezka>.thumb`, 800 px, 1:1 z src/lib/imageThumbs.ts. Wczesniej szly przez transformacje
// w locie (/storage/v1/render/image/), ale to platna funkcja liczona od obrazow zrodlowych,
// ktora Supabase blokuje po przekroczeniu limitu - wtedy podglad linku zostawal bez zdjec.
// Duze kadry (okladka 1200 px) biora oryginal, bo miniatura bylaby tam rozmyta.
const THUMB_SUFFIX = ".thumb";
const THUMB_MAX_W = 400;

function img(raw: string | null | undefined, w: number, _h?: number): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) return SITE + raw;
  if (!/^https?:/i.test(raw)) return `${SITE}/api/place-photo?ref=${encodeURIComponent(raw)}&w=${w}`;
  if (raw.includes("/storage/v1/object/public/") && w <= THUMB_MAX_W) {
    const [base, query] = raw.split("?");
    return query ? `${base}${THUMB_SUFFIX}?${query}` : `${base}${THUMB_SUFFIX}`;
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

// Werdykt miejsca (pigułka na kafelku przystanku) - 1:1 z src/lib/routeTags.ts. Trzymamy tu
// wlasna, mala kopie zamiast importu: to funkcja brzegowa Vercela, poza drzewem aplikacji.
// W bazie leza ID (nowe wpisy) albo polskie napisy (sprzed 2026-09-01) - obsluguja oba klucze.
const VERDICT_PL: Record<string, string> = {
  must_visit: "Musisz odwiedzić!", worth_seeing: "Przy okazji", stop_by: "Warto wpaść",
  worth_visiting: "Warto odwiedzić", not_worth: "Nie warto odwiedzać",
  "Musisz odwiedzić!": "Musisz odwiedzić!", "Przy okazji": "Przy okazji", "Warto wpaść": "Warto wpaść",
  "Warto odwiedzić": "Warto odwiedzić", "Nie warto odwiedzać": "Nie warto odwiedzać",
};
const verdictLabel = (tags: any): string | null => {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) if (typeof t === "string" && VERDICT_PL[t]) return VERDICT_PL[t];
  return null;
};

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#FEFEFE;color:#0E0E0E;font:16px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:0 20px 96px}
.bar{position:sticky;top:0;z-index:10;background:rgba(254,254,254,.94);backdrop-filter:blur(12px);border-bottom:1px solid #eee}
.bar .in{max-width:560px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:10px}
.mark{width:34px;height:34px;flex:none;border-radius:8px;display:block}
.brand{font-weight:800;letter-spacing:-.01em}
/* Plakietka w pasku stoi w JEDNYM rzedzie ze znakiem i ma te sama wysokosc (34 px), wiec obie
   rzeczy leza na wspolnej osi. Dopisek "wkrotce" byl wczesniej POD plakietka i to on rozpychal
   pasek w pionie - plakietka wjezdzala wtedy wyzej niz logo. Informacja o premierze zostaje
   w stopce, przy duzej plakietce. */
.badge{margin-left:auto;display:flex;align-items:center;text-decoration:none;line-height:0}
.badge img{height:34px;width:auto;display:block}
.badge.off img{filter:grayscale(1);opacity:.4}
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

/* ── WIDOK WYJAZDU (Figma "[NEW] Ekrany" -> "Udostepnianie wyjazdow oraz list" ->
   "Widok wyswietlania wyjazdu"). Ta sama kompozycja, co zapowiedz w aplikacji
   (src/pages/SharedRoute.tsx, galaz isWeb && !previewOpened): zolte tlo, pasek instalacji,
   karta z eksploracji, pasek pierwszych przystankow, jedno wyjscie dalej. Dzieki temu autor,
   wysylajac link, widzi u siebie dokladnie to, co zobaczy odbiorca - a odbiorca dostaje ten
   sam widok niezaleznie od tego, czy komunikator otworzyl adres krotki (/r/<id>), czy pelny.
   LISTA zostaje na starym, dokumentowym ukladzie - jej wyglad jest jeszcze projektowany. */
body.trip{background:#FDF184}
.ins{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#F9F9F9;border-bottom:1px solid #FDF184;padding:12px 16px}
.ins .l{display:flex;align-items:center;gap:12px;min-width:0}
.ins .tile{width:44px;height:44px;flex:none;border-radius:14px;background:#FDF184;display:flex;align-items:center;justify-content:center}
.ins .tile img{width:26px;height:26px;display:block}
.ins b{display:block;font-size:15px;font-weight:700;color:#5B2C06;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ins .s{display:block;font-size:12px;line-height:1.25;color:rgba(91,44,6,.85)}
.ins a{flex:none;display:inline-flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:#EE5307;color:#fff;font-size:12.5px;font-weight:800;text-decoration:none}
.page{max-width:420px;margin:0 auto;padding:24px 20px 36px;display:flex;flex-direction:column;align-items:center}
.tc{position:relative;width:100%;max-width:340px;height:520px;border-radius:24px;overflow:hidden;background:#fcede3;display:block;text-decoration:none}
.tc .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.tc .veil{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.8) 0%,rgba(0,0,0,.1) 55%,rgba(0,0,0,.25) 100%)}
.tc .txt{position:absolute;left:0;right:0;bottom:24px;padding:0 20px;color:#fff}
.tc .who{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:6px;text-shadow:0 1px 3px rgba(0,0,0,.45)}
.tc .who img{width:24px;height:24px;border-radius:50%;object-fit:cover;background:#fcede3;box-shadow:0 0 0 2px rgba(0,0,0,.25)}
.tc h1{font-size:24px;font-weight:900;line-height:1.15;text-shadow:0 2px 6px rgba(0,0,0,.45)}
.tc .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tc .chips span{background:rgba(255,255,255,.15);border-radius:999px;padding:4px 10px;font-size:11px;color:rgba(255,255,255,.85)}
/* Karta MIEJSCA (Figma "Udostępnianie wyjazdów oraz list" -> miejsce, 2026-09-11): ta sama
   karta 9:16, co w zakladce Miejsca - kategoria w lewym gornym rogu, logo lokalu, nazwa,
   adres z pinezka, plakietka wydarzenia i tagi. */
.tc.place{height:auto;aspect-ratio:9/16;max-height:600px}
.tc .catchip{position:absolute;left:14px;top:14px;background:#D6332B;color:#fff;font-size:13px;font-weight:700;border-radius:999px;padding:7px 12px}
.tc .logo{width:56px;height:56px;border-radius:50%;object-fit:cover;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);margin-bottom:10px;display:block}
.tc .addr{display:flex;align-items:center;gap:5px;font-size:14px;color:rgba(255,255,255,.85);margin-top:6px;text-shadow:0 1px 3px rgba(0,0,0,.45)}
.tc .addr svg{width:14px;height:14px;flex:none}
.tc .promo{display:inline-block;margin-top:8px;background:#F7941D;color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:4px 10px}
.tc .ph0{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.tc .ph0 img{width:38%;opacity:.95}
.day{display:flex;align-items:center;gap:8px;width:100%;margin:28px 0 8px}
.day i{width:3px;height:16px;border-radius:2px;background:#EE5307;flex:none}
.day p{margin:0;font-family:Sigmar,Inter,sans-serif;font-size:15px;line-height:1;color:#EE5307}
/* Pasek wychodzi poza padding strony w prawo, zeby kafelki dojezdzaly do krawedzi ekranu
   zamiast zatrzymywac sie 20 px przed nia (prosba Nat 2026-09-09). Z lewej padding zostaje -
   pierwszy kafelek ma sie rownac z naglowkiem "Dzień 1" i karta wyjazdu. */
.strip{display:flex;gap:12px;width:calc(100% + 20px);margin-right:-20px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.strip::-webkit-scrollbar{display:none}
.pl{display:flex;align-items:center;gap:12px;width:264px;flex:none;background:#fff;border-radius:24px;padding:12px}
.pl .pic{position:relative;width:54px;height:80px;flex:none;border-radius:12px;overflow:hidden;background:#fcede3}
.pl .pic .p{width:100%;height:100%;object-fit:cover;display:block}
.pl .pic .ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pl .pic .ic img{width:26px;height:26px;opacity:.9}
.pl .pic i{position:absolute;left:4px;top:4px;min-width:16px;height:16px;padding:0 3px;border-radius:10px;background:#EE5307;color:#fff;font-size:10px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center}
.pl .d{display:flex;flex-direction:column;justify-content:space-between;height:80px;min-width:0;flex:1;padding:2px 0}
/* Nazwa ma STALE dwa wiersze. Sam -webkit-line-clamp tu nie wystarcza: element jest
   dzieckiem kontenera flex, a przegladarka blokifikuje wtedy display:-webkit-box i clamp
   przestaje dzialac - tekst ucinal sie w polowie drugiej linii (zgloszenie Nat 2026-09-09).
   Wysokosc podana w "em" jest odporna na to samo: 2 x line-height, ciecie zawsze na granicy
   wiersza. flex:none pilnuje, zeby kontener jej nie sciskal. */
.pl .n{font-size:14px;font-weight:700;line-height:1.19;color:#000;flex:none;height:2.38em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}
.pl .b{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pl .v{background:#FDF184;color:#5B2C06;border-radius:999px;padding:4px 10px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl .c{font-size:11px;color:#666;flex:none}
/* KARTA LISTY - makieta Nat "Udostępnianie list" (2026-09-09). Biala karta na zoltym tle,
   nad siatka autor + tytul + kreska, w siatce 3x3 kafelki miejsc; ostatnie pole zamienia sie
   w licznik "+N", gdy miejsc jest wiecej niz dziewiec. */
.lc{width:100%;max-width:360px;background:#fff;border-radius:24px;padding:16px 16px 20px;box-shadow:0 1px 6px rgba(0,0,0,.06)}
.lc .hd{display:flex;align-items:center;gap:12px}
.lc .hd img{width:48px;height:48px;flex:none;border-radius:50%;object-fit:cover;background:#fcede3}
.lc .hd b{display:block;font-size:19px;font-weight:900;line-height:1.2;color:#0E0E0E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lc .hd span{display:block;font-size:13px;color:#979797;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lc hr{border:0;height:1px;background:rgba(238,83,7,.7);margin:12px 0}
.lc .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tl{position:relative;aspect-ratio:3/4;border-radius:16px;overflow:hidden;background:#fcede3}
.tl img.ph{width:100%;height:100%;object-fit:cover;display:block}
.tl .veil{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55) 0%,transparent 55%)}
.tl .ic{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40%;max-width:46px;opacity:.9}
.tl .cat{position:absolute;right:6px;top:6px;max-width:80%;border-radius:999px;background:rgba(91,44,6,.9);color:#fff;font-size:9.5px;font-weight:700;padding:2px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl .nm2{position:absolute;left:8px;right:8px;bottom:6px;font-size:11px;font-weight:700;line-height:1.2;height:2.4em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}
.tl.has .nm2{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.tl.none .nm2{color:rgba(14,14,14,.75)}
.tl.more{display:flex;align-items:center;justify-content:center;background:#FDF184}
.tl.more span{font-family:Sigmar,Inter,sans-serif;font-size:26px;line-height:1;color:#EE5307}
.go{margin-top:32px;width:100%;max-width:420px;border-radius:999px;background:#EE5307;color:#fff;font-size:17px;font-weight:800;text-align:center;padding:16px 0;text-decoration:none;display:block}
.page .tail{margin:16px 0 0;text-align:center;font-size:12.5px;line-height:1.4;color:rgba(91,44,6,.8)}
/* Arkusz po "Zobacz wyjazd" - w stylu modala z landingu (zolty panel, znak marki, naglowek
   Sigmarem, brazowa tresc, zapis na premiere w jednym wierszu). Aplikacji nie ma jeszcze
   w App Store, wiec guzik nie ma dokad prowadzic; zamiast tego daje dwie drogi do dostepu.
   max-height + wlasne przewijanie: na niskim ekranie ma sie skurczyc, a nie wypchnac CTA
   poza widok (prosba Nat 2026-09-09). */
.ov{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}
.ov.on{display:flex}
.md{position:relative;width:100%;max-width:440px;max-height:92dvh;overflow-y:auto;background:#FEFEFE;border-radius:24px 24px 0 0}
.md .x{position:absolute;right:14px;top:14px;z-index:2;width:32px;height:32px;border:0;border-radius:999px;background:rgba(0,0,0,.06);color:#5B2C06;font-size:17px;line-height:1;cursor:pointer}
.md .hero{background:#FDF184;padding:34px 24px 26px;text-align:center;border-radius:24px 24px 0 0}
.md .hero img.mark{width:52px;height:auto;margin:0 auto;display:block}
.md h2{margin:16px 0 0;font-family:Sigmar,Inter,sans-serif;font-size:26px;line-height:1.15;font-weight:400;color:#EE5307}
.md .sub{margin:8px 0 0;font-size:14px;line-height:1.45;color:#5B2C06}
/* Pole na PELNA szerokosc, guzik POD nim (prosba Nat 2026-09-09) - wiersz obok siebie zwezal
   pole na tyle, ze dluzszy adres nie miescil sie w widoku podczas pisania. */
.md form{display:flex;flex-direction:column;gap:10px;margin:16px 0 0}
.md input{width:100%;height:52px;border:0;border-radius:999px;padding:0 20px;font:16px Inter,sans-serif;background:#fff;color:#5B2C06}
.md input::placeholder{color:rgba(91,44,6,.45)}
.md input:focus{outline:2px solid #EE5307;outline-offset:-2px}
.md .send{width:100%;height:52px;border:0;border-radius:999px;background:#EE5307;color:#fff;font:800 16px Inter,sans-serif;cursor:pointer}
.md .send[disabled]{opacity:.55}
.md .consent{margin:12px 0 0;font-size:12px;line-height:1.45;color:rgba(91,44,6,.8)}
.md .consent a{color:inherit}
.md .msg{margin:12px 0 0;font-size:13px;line-height:1.4;color:#5B2C06;font-weight:600}
.md .msg.bad{color:#C0392B}
/* Dolna czesc: droga "chce juz teraz". Guzik WYSRODKOWANY (prosba Nat 2026-09-09). */
.md .foot2{padding:24px;text-align:center}
.md .tf{display:inline-flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none;background:#EE5307;color:#fff;border-radius:999px;padding:12px 26px}
.md .tf b{font-size:15px;font-weight:800}
.md .tf span{font-size:12.5px;opacity:.9}
.md .later{display:block;width:100%;margin-top:14px;padding:10px 0;border:0;background:0;font:600 14px Inter,sans-serif;color:#979797;cursor:pointer}
`;

// Pasek instalacji nad trescia wyjazdu. Odbiorca linku najczesciej nie ma jeszcze aplikacji,
// a wyjazd jest jedynym powodem, dla ktorego moglby jej chciec - wiec sciezke dostaje od razu.
// Do premiery prowadzi na zapisy przedpremierowe (TestFlight); potem wystarczy podmienic adres.
const installBar = () => `<div class="ins"><div class="l">
<span class="tile"><img src="${SYMBOL_IMG}" alt=""></span>
<span><b>Spontaway</b><span class="s">Odkrywaj, planuj, dziel się!</span></span></div>
<a href="${TESTFLIGHT_URL}" target="_blank" rel="noreferrer noopener">Dołącz przedpremierowo</a></div>`;

// Arkusz wyboru po "Zobacz wyjazd" (prosba Nat 2026-09-09). Aplikacji nie ma jeszcze
// w App Store, wiec guzik nie ma dokad prowadzic - zamiast udawac, ze prowadzi, pyta wprost
// o droge do dostepu: testy przedpremierowe (dziala od razu) albo powiadomienie o premierze.
//
// Zapis na premiere idzie PROSTO do tabeli `waitlist` (polityka "Anyone can join"), tym samym
// kluczem anonimowym, ktory i tak siedzi w aplikacji - bez wlasnego endpointu do utrzymania.
// Zrodlo `share_trip` odroznia te zapisy od landingu, wiec widac, ile daja same linki.
//
// Bez JavaScriptu guzik zostaje zwyklym linkiem na TestFlight - odbiorca nie zostaje z niczym.
const choiceSheet = () => `<div class="ov" id="ov"><div class="md">
<button class="x" id="cl" type="button" aria-label="Zamknij">&times;</button>
<div class="hero">
<img class="mark" src="${SYMBOL_IMG}" alt="">
<h2>Premiera już wkrótce</h2>
<p class="sub">Spontaway pojawi się w App Store lada moment. Zostaw swojego maila, a powiadomimy Cię o starcie:</p>
<form id="wl"><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="twoj@email.pl" required>
<button class="send" id="sd" type="submit">Powiadom mnie</button></form>
<p class="consent">Zapisując się, zgadzasz się na przetwarzanie adresu e-mail w celu powiadomienia o premierze. Szczegóły w <a href="${SITE}/#/privacy">polityce prywatności</a>.</p>
<p class="msg" id="mg"></p>
</div>
<div class="foot2">
<a class="tf" href="${TESTFLIGHT_URL}" target="_blank" rel="noreferrer noopener">
<b>Dołącz przedpremierowo</b><span>Dostęp od razu, przez TestFlight</span></a>
<button class="later" id="lt" type="button">Nie teraz</button>
</div>
</div></div>
<script>
(function(){
  var SUPA=${JSON.stringify(SUPA)}, ANON=${JSON.stringify(ANON)};
  var ov=document.getElementById("ov"), go=document.getElementById("go");
  var form=document.getElementById("wl"), inp=document.getElementById("em");
  var send=document.getElementById("sd"), msg=document.getElementById("mg");
  function hide(){ ov.classList.remove("on"); }
  go.addEventListener("click", function(e){ e.preventDefault(); ov.classList.add("on"); });
  document.getElementById("cl").addEventListener("click", hide);
  document.getElementById("lt").addEventListener("click", hide);
  ov.addEventListener("click", function(e){ if(e.target===ov) hide(); });
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var v=(inp.value||"").trim().toLowerCase();
    if(v.length<5 || v.indexOf("@")<1 || v.lastIndexOf(".")<v.indexOf("@")+2){
      msg.className="msg bad"; msg.textContent="Podaj poprawny adres e-mail."; return;
    }
    send.disabled=true; msg.className="msg"; msg.textContent="Zapisujemy...";
    var h={apikey:ANON, Authorization:"Bearer "+ANON, "Content-Type":"application/json"};
    fetch(SUPA+"/rest/v1/waitlist",{method:"POST",headers:h,body:JSON.stringify({email:v,source:"share_trip",language:"pl"})})
      .then(function(r){
        // 409 = ten adres juz jest na liscie. Dla czlowieka to sukces, nie blad.
        if(!r.ok && r.status!==409) throw 0;
        fetch(SUPA+"/functions/v1/send-waitlist-email",{method:"POST",headers:h,body:JSON.stringify({email:v,lang:"pl"})}).catch(function(){});
        form.style.display="none";
        msg.className="msg"; msg.textContent="Gotowe. Damy znać mailem, gdy aplikacja pojawi się w App Store.";
      })
      .catch(function(){ send.disabled=false; msg.className="msg bad"; msg.textContent="Nie udało się zapisać. Spróbuj jeszcze raz."; });
  });
})();
</script>`;

function shell(o: { title: string; desc: string; image: string; url: string; body: string; noun?: string; variant?: "trip"; imageW?: number; imageH?: number }) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)} · spontaway</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="noindex">
<meta property="og:site_name" content="spontaway"><meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${esc(o.image)}">
<meta property="og:image:secure_url" content="${esc(o.image)}">
<meta property="og:image:alt" content="${esc(o.title)}">
${o.imageW && o.imageH ? `<meta property="og:image:width" content="${o.imageW}"><meta property="og:image:height" content="${o.imageH}">` : ""}
<meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(o.image)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Sigmar&display=swap" rel="stylesheet">
<style>${CSS}</style></head>${o.variant === "trip" ? `<body class="trip">
${installBar()}
${o.body}` : `<body>
<div class="bar"><div class="in"><img class="mark" src="${BRAND_IMG}" alt=""><span class="brand">spontaway</span>
${ctaTop()}</div></div>
<div class="wrap">${o.body}
<div class="foot"><p>${o.noun === "route" ? "Ten wyjazd powstał w spontaway" : o.noun === "list" ? "Ta lista powstała w spontaway" : "spontaway to aplikacja"} - do odkrywania miejsc i planowania wyjazdów ze znajomymi.</p>
${ctaBig()}</div></div>`}
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
  const isPlace = searchParams.get("t") === "place";
  const id = searchParams.get("id") ?? "";
  const url = `${SITE}/${isPlace ? "p" : isList ? "l" : "r"}/${id}`;

  const missing = () => new Response(shell({
    title: "Treść niedostępna", desc: "Ta treść mogła zostać usunięta lub jest prywatna.", image: BRAND_IMG, url,
    body: `<div class="empty"><img class="mark" src="${BRAND_IMG}" alt=""><h1>Treść niedostępna</h1>
<p class="meta">Mogła zostać usunięta albo jest prywatna.</p></div>`,
  }), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!UUID.test(id)) return missing();

  // MIEJSCE (wizytowka) - link z "Udostępnij to miejsce" (Figma, 2026-09-11). Widoczne to, co
  // przepuszcza RLS dla klucza anonimowego: aktywne miejsce + aktywny profil biznesowy.
  if (isPlace) {
    const [pl] = await rest(`places?id=eq.${id}&select=place_name,address,city,category,photo_url,gallery_urls,google_place_id,business_profiles(cover_image_url,logo_url,event_title,tags,gallery_urls)&limit=1`);
    if (!pl) return missing();
    const bp = Array.isArray(pl.business_profiles) ? pl.business_profiles[0] : pl.business_profiles;
    const bizGallery: string[] = Array.isArray(bp?.gallery_urls) ? bp.gallery_urls.filter(Boolean) : [];
    // Kolejnosc jak w aplikacji (enrichWithBusinessProfile): wlasne zdjecie lokalu > skurowana
    // okladka > zdjecie spolecznosci. Bez Google.
    const curated = typeof pl.photo_url === "string" && (pl.photo_url.includes("/place-photos-cache/manual/") || pl.photo_url.includes("/api/place-photo")) ? pl.photo_url : null;
    const community = await communityPhotos([placeKey(pl.google_place_id, pl.place_name)]);
    const rawPhoto = bp?.cover_image_url || bizGallery[0] || curated || first(pl.gallery_urls) || community.get(placeKey(pl.google_place_id, pl.place_name)) || null;
    const cover = img(rawPhoto, 1200, 630);
    const logo = img(bp?.logo_url, 112, 112);
    const icon = iconFor(pl.category);
    const cat = catLabel(pl.category);
    const tags: string[] = (Array.isArray(bp?.tags) ? bp.tags : []).filter(Boolean).slice(0, 3);
    const title = pl.place_name || "Miejsce";
    const desc = [pl.address, cat && pl.category !== "other" ? cat : null, pl.city].filter(Boolean).join(" · ") || "Miejsce w spontaway";
    const pin = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

    const body = `<div class="page">
<div class="tc place">
${cover ? `<img class="bg" src="${esc(cover)}" alt="">` : icon ? `<div class="ph0"><img src="${esc(icon)}" alt=""></div>` : ""}
<div class="veil"></div>
${cat && pl.category !== "other" ? `<span class="catchip">${esc(cat)}</span>` : ""}
<div class="txt">
${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}
<h1>${esc(title)}</h1>
${pl.address ? `<div class="addr">${pin}<span>${esc(pl.address)}</span></div>` : ""}
${bp?.event_title ? `<span class="promo">${esc(bp.event_title)}</span>` : ""}
${tags.length ? `<div class="chips">${tags.map((c: string) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
</div></div>
<a class="go" id="go" href="${TESTFLIGHT_URL}">Zobacz miejsce</a>
<p class="tail">To miejsce znajdziesz w spontaway - aplikacji do odkrywania miejsc i planowania wyjazdów ze znajomymi.</p>
</div>
${choiceSheet()}`;
    const ogSize = cover && isCrawler(req) ? await imageSize(cover) : null;
    return new Response(shell({
      title, desc, url, body, noun: "place", variant: "trip",
      image: cover ?? OG_BANNER.url,
      imageW: cover ? ogSize?.w : OG_BANNER.w,
      imageH: cover ? ogSize?.h : OG_BANNER.h,
    }), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  }

  if (isList) {
    const [col] = await rest(`discovery_collections?id=eq.${id}&select=title,city,description,user_id&limit=1`);
    if (!col) return missing();
    const items = await rest(`discovery_items?collection_id=eq.${id}&select=place_name,category,short_desc,photo_url,images,google_place_id&order=order_index.asc&limit=60`);
    const photos = await communityPhotos(items.map((it) => placeKey(it.google_place_id, it.place_name)));
    const [author] = col.user_id ? await rest(`profiles?id=eq.${col.user_id}&select=username,avatar_url&limit=1`) : [];
    const title = col.title || "Lista miejsc";
    const count = `${items.length} ${plural(items.length)}`;
    const desc = col.description || [col.city, items.length ? count : null].filter(Boolean).join(" · ");

    // Siatka 3x3. Gdy miejsc jest wiecej niz dziewiec, ostatnie pole to licznik "+N" - lepiej
    // pokazac osiem miejsc i uczciwa reszte niz urwac dziewiate bez slowa.
    const CELLS = 9;
    const shown = items.length > CELLS ? items.slice(0, CELLS - 1) : items.slice(0, CELLS);
    const restN = items.length - shown.length;
    const tiles = shown.map((it) => {
      const photo = img(it.photo_url || first(it.images) || photos.get(placeKey(it.google_place_id, it.place_name)), 160, 160);
      const icon = iconFor(it.category);
      const cat = catLabel(it.category);
      return `<div class="tl ${photo ? "has" : "none"}">
${photo ? `<img class="ph" src="${esc(photo)}" alt="" loading="lazy"><div class="veil"></div>` : icon ? `<img class="ic" src="${esc(icon)}" alt="" loading="lazy">` : ""}
${cat && it.category !== "other" ? `<span class="cat">${esc(cat)}</span>` : ""}
<p class="nm2">${esc(it.place_name || "")}</p></div>`;
    }).join("");

    const body = `<div class="page">
<div class="lc">
<div class="hd"><img src="${esc(img(author?.avatar_url, 64, 64) ?? BRAND_IMG)}" alt="">
<span style="min-width:0"><b>${esc(title)}</b><span>${esc([col.city, count].filter(Boolean).join(" - "))}</span></span></div>
<hr>
<div class="grid">${tiles}${restN > 0 ? `<div class="tl more"><span>+${restN}</span></div>` : ""}</div>
</div>
<a class="go" id="go" href="${TESTFLIGHT_URL}">Zobacz listę</a>
<p class="tail">Ta lista powstała w spontaway - aplikacji do odkrywania miejsc i planowania wyjazdów ze znajomymi.</p>
</div>
${choiceSheet()}`;
    // Obrazek podgladu dla LISTY zostaje markowy (lista nie ma jednej okladki), ale jako BANER
    // 1800x945, nie kwadratowa ikona - inaczej komunikator rysuje maly kafelek zamiast karty
    // (prosba Nat 2026-09-09).
    return new Response(shell({ title, desc, image: OG_BANNER.url, imageW: OG_BANNER.w, imageH: OG_BANNER.h, url, body, noun: "list", variant: "trip" }), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  }

  const [route] = await rest(`routes?id=eq.${id}&select=title,city,description,cover_url,list_cover_url,user_id&limit=1`);
  if (!route) return missing();
  const pins = await rest(`pins?route_id=eq.${id}&select=place_name,category,tags,images,user_photo_urls,image_url,photo_url,pin_order,place_id&order=pin_order.asc&limit=80`);
  const pinPhotos = await communityPhotos(pins.map((p) => placeKey(null, p.place_name)));
  const [author] = route.user_id ? await rest(`profiles?id=eq.${route.user_id}&select=username,avatar_url&limit=1`) : [];
  const title = route.title || (route.city ? `Wyjazd do ${route.city}` : "Wyjazd");
  const count = `${pins.length} ${plural(pins.length)}`;
  const desc = route.description || [route.city, pins.length ? count : null].filter(Boolean).join(" · ");
  const cover = img(route.list_cover_url || route.cover_url, 1200, 630);
  const avatar = img(author?.avatar_url, 64, 64);

  // Kafle na karcie = kategorie miejsc (tak samo jak karta w eksploracji, `cardTags`).
  const chips = [...new Set(pins.filter((p) => p.category && p.category !== "other").map((p) => catLabel(p.category)).filter(Boolean))].slice(0, 3);

  // Pierwsze przystanki - to one mowia, co jest w srodku. Osiem, jak w zapowiedzi w aplikacji.
  const strip = pins.slice(0, 8).map((p, i) => {
    const photo = img(p.image_url || first(p.images) || first(p.user_photo_urls) || p.photo_url || pinPhotos.get(placeKey(null, p.place_name)), 160, 160);
    const icon = iconFor(p.category);
    const verdict = verdictLabel(p.tags);
    const cat = catLabel(p.category);
    return `<div class="pl"><div class="pic">
${photo ? `<img class="p" src="${esc(photo)}" alt="" loading="lazy">` : icon ? `<span class="ic"><img src="${esc(icon)}" alt="" loading="lazy"></span>` : ""}
<i>${i + 1}</i></div>
<div class="d"><p class="n">${esc(p.place_name || "")}</p>
<div class="b">${verdict ? `<span class="v">${esc(verdict)}</span>` : "<span></span>"}${cat && p.category !== "other" ? `<span class="c">${esc(cat)}</span>` : ""}</div></div></div>`;
  }).join("");

  // Wejscie w aplikacje z pominieciem zapowiedzi (`?full=1`) - odbiorca widzial ja juz tutaj,
  // wiec druga taka sama strona po kliknieciu bylaby dreptaniem w miejscu.
  const body = `<div class="page">
<div class="tc">
${cover ? `<img class="bg" src="${esc(cover)}" alt="">` : ""}
<div class="veil"></div>
<div class="txt">
<div class="who">${avatar ? `<img src="${esc(avatar)}" alt="">` : ""}<span>${[author?.username ? `@${esc(author.username)}` : null, route.city ? esc(route.city) : null, pins.length ? count : null].filter(Boolean).join(" · ")}</span></div>
<h1>${esc(title)}</h1>
${chips.length ? `<div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
</div></div>
${strip ? `<div class="day"><i></i><p>Dzień 1</p></div><div class="strip">${strip}</div>` : ""}
<a class="go" id="go" href="${TESTFLIGHT_URL}">Zobacz wyjazd</a>
<p class="tail">Ten wyjazd powstał w spontaway - aplikacji do odkrywania miejsc i planowania wyjazdów ze znajomymi.</p>
</div>
${choiceSheet()}`;
  // Wymiary okladki liczymy TYLKO dla robota budujacego podglad - czlowiek nie czeka na nic
  // ekstra. Bez okladki lecimy banerem marki, ktory ma wymiary znane z gory.
  const ogSize = cover && isCrawler(req) ? await imageSize(cover) : null;
  return new Response(shell({
    title, desc, url, body, noun: "route", variant: "trip",
    image: cover ?? OG_BANNER.url,
    imageW: cover ? ogSize?.w : OG_BANNER.w,
    imageH: cover ? ogSize?.h : OG_BANNER.h,
  }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
  });
}
