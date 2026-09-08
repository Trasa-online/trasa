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
const ctaTop = () => CTA_READY
  ? `<a class="badge" href="${esc(APP_STORE_URL!)}"><img src="${BADGE}" alt="${CTA_LABEL}"></a>`
  : `<span class="badge off" title="Dostępne wkrótce"><img src="${BADGE}" alt="${CTA_LABEL}"></span>`;
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
.day{display:flex;align-items:center;gap:8px;width:100%;margin:28px 0 8px}
.day i{width:3px;height:16px;border-radius:2px;background:#EE5307;flex:none}
.day p{margin:0;font-family:Sigmar,Inter,sans-serif;font-size:15px;line-height:1;color:#EE5307}
.strip{display:flex;gap:12px;width:100%;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.strip::-webkit-scrollbar{display:none}
.pl{display:flex;align-items:center;gap:12px;width:264px;flex:none;background:#fff;border-radius:24px;padding:12px}
.pl .pic{position:relative;width:54px;height:80px;flex:none;border-radius:12px;overflow:hidden;background:#fcede3}
.pl .pic .p{width:100%;height:100%;object-fit:cover;display:block}
.pl .pic .ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pl .pic .ic img{width:26px;height:26px;opacity:.9}
.pl .pic i{position:absolute;left:4px;top:4px;min-width:16px;height:16px;padding:0 3px;border-radius:10px;background:#EE5307;color:#fff;font-size:10px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center}
.pl .d{display:flex;flex-direction:column;justify-content:space-between;height:80px;min-width:0;flex:1;padding:2px 0}
.pl .n{font-size:14px;font-weight:700;line-height:1.19;color:#000;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl .b{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pl .v{background:#FDF184;color:#5B2C06;border-radius:999px;padding:4px 10px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl .c{font-size:11px;color:#666;flex:none}
.go{margin-top:32px;width:100%;max-width:420px;border-radius:999px;background:#EE5307;color:#fff;font-size:17px;font-weight:800;text-align:center;padding:16px 0;text-decoration:none;display:block}
.page .tail{margin:16px 0 0;text-align:center;font-size:12.5px;line-height:1.4;color:rgba(91,44,6,.8)}
/* Arkusz wyboru po "Zobacz wyjazd". Aplikacji nie ma jeszcze w App Store, wiec guzik nie ma
   dokad prowadzic - zamiast tego pyta, ktora droga do dostepu odbiorca wybiera: testy
   przedpremierowe (dziala od razu) czy powiadomienie o premierze (prosba Nat 2026-09-09).
   Wchodzi od dolu, jak arkusze w aplikacji. */
.ov{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}
.ov.on{display:flex}
.md{width:100%;max-width:440px;background:#FEFEFE;border-radius:24px 24px 0 0;padding:10px 20px calc(24px + env(safe-area-inset-bottom,0px))}
.md .grab{width:36px;height:4px;border-radius:2px;background:#E4E4E4;margin:0 auto 16px}
.md h2{margin:0;font-size:20px;font-weight:900;letter-spacing:-.01em}
.md .sub{margin:6px 0 18px;font-size:14px;line-height:1.4;color:#7A7A7A}
.opt{display:block;width:100%;border:0;text-align:left;text-decoration:none;border-radius:20px;padding:14px 16px;margin-bottom:10px;font:inherit;cursor:pointer}
.opt .t{display:block;font-size:15px;font-weight:800}
.opt .u{display:block;font-size:12.5px;margin-top:2px;opacity:.85}
.opt.hot{background:#EE5307;color:#fff}
.opt.cool{background:#F3F3F3;color:#0E0E0E}
.md form{display:none;margin:2px 0 10px}
.md form .lbl{display:block;font-size:15px;font-weight:800;margin:2px 0 8px}
.md form.on{display:block}
.md input{width:100%;height:48px;border:1px solid #E4E4E4;border-radius:16px;padding:0 14px;font:16px Inter,sans-serif;background:#fff;color:#0E0E0E}
.md input:focus{outline:0;border-color:#EE5307}
.md .send{width:100%;height:48px;margin-top:10px;border:0;border-radius:16px;background:#EE5307;color:#fff;font:800 15px Inter,sans-serif;cursor:pointer}
.md .send[disabled]{opacity:.55}
.md .msg{margin:10px 0 0;font-size:13px;line-height:1.4;color:#7A7A7A}
.md .msg.bad{color:#C0392B}
.md .close{display:block;width:100%;margin-top:6px;padding:12px 0;border:0;background:0;font:600 14px Inter,sans-serif;color:#979797;cursor:pointer}
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
<div class="grab"></div>
<h2>Wyjazd czeka w aplikacji</h2>
<p class="sub">spontaway nie jest jeszcze w App Store. Wybierz, jak chcesz dostać dostęp:</p>
<a class="opt hot" href="${TESTFLIGHT_URL}" target="_blank" rel="noreferrer noopener" id="tf">
<span class="t">Dołącz przedpremierowo</span><span class="u">Dostęp od razu, przez TestFlight</span></a>
<button class="opt cool" id="pick" type="button">
<span class="t">Zapisz się na premierę</span><span class="u">Damy znać mailem, gdy aplikacja będzie w App Store</span></button>
<form id="wl"><span class="lbl">Zapisz się na premierę</span><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="twoj@email.pl" required>
<button class="send" id="sd" type="submit">Zapisz się</button></form>
<p class="msg" id="mg"></p>
<button class="close" id="cl" type="button">Nie teraz</button>
</div></div>
<script>
(function(){
  var SUPA=${JSON.stringify(SUPA)}, ANON=${JSON.stringify(ANON)};
  var ov=document.getElementById("ov"), go=document.getElementById("go");
  var pick=document.getElementById("pick"), form=document.getElementById("wl");
  var inp=document.getElementById("em"), send=document.getElementById("sd"), msg=document.getElementById("mg");
  function hide(){ ov.classList.remove("on"); }
  go.addEventListener("click", function(e){ e.preventDefault(); ov.classList.add("on"); });
  document.getElementById("cl").addEventListener("click", hide);
  ov.addEventListener("click", function(e){ if(e.target===ov) hide(); });
  pick.addEventListener("click", function(){ form.classList.add("on"); pick.style.display="none"; inp.focus(); });
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
        form.classList.remove("on");
        msg.className="msg"; msg.textContent="Gotowe. Damy znać mailem, gdy aplikacja pojawi się w App Store.";
      })
      .catch(function(){ send.disabled=false; msg.className="msg bad"; msg.textContent="Nie udało się zapisać. Spróbuj jeszcze raz."; });
  });
})();
</script>`;

function shell(o: { title: string; desc: string; image: string; url: string; body: string; noun?: string; variant?: "trip" }) {
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
  return new Response(shell({ title, desc, image: cover ?? BRAND_IMG, url, body, noun: "route", variant: "trip" }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
  });
}
