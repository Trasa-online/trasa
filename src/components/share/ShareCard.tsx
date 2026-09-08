import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { avatarSrc } from "@/lib/avatar";
import { resolveStored } from "@/components/PlacePhoto";
import { thumbUrl } from "@/lib/imageUrl";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { localizeTag, verdictOf } from "@/lib/routeTags";
import { subcategoryLabelLocalized } from "@/lib/categories";
import TrasaBigCard from "@/components/home/TrasaBigCard";
import { buildShareTargets, ShareTargetButton } from "@/components/share/shareTargets";

// UDOSTEPNIANIE LISTY / WYJAZDU - arkusz z podgladem i kanalami (wzor: Pinterest, prosba Nat
// 2026-09-01). Otwiera sie z guzika udostepniania ORAZ automatycznie po zrzucie ekranu.
//
// Uklad ma trzy warstwy, kazda po cos innego:
//  1. PODGLAD - pomniejszona, wierna kopia karty. Pokazuje, co dokladnie pojdzie dalej.
//  2. KANALY - skroty do aplikacji, w ktorych ludzie faktycznie wysylaja linki.
//  3. PELNY EKRAN - dotkniecie podgladu rozwija karte na caly ekran, do zrzutu na Stories.
//
// DWA SZABLONY, nie jeden (eksploracja w Figmie, sekcja "Udostępnianie: lista vs wyjazd").
// Lista i wyjazd sprzedaja sie czym INNYM, wiec kazdy dowodzi czego innego:
//  - LISTA to zbior: liczy sie ILOSC i kuracja -> siatka kafelkow z licznikiem "+N",
//  - WYJAZD to historia: licza sie TRASA i ludzie -> okladka, ponumerowane przystanki, awatary.
// Jeden uniwersalny szablon obslugiwalby oba gorzej.
//
// Czego tu NIE ma: wyslania karty jako OBRAZKA. iOS nie da podac systemowi zrzutu, ktorego user
// jeszcze nie zrobil, a renderowanie DOM-u do PNG wymaga biblioteki i CORS-u na wszystkich
// zdjeciach. Dlatego kanaly nios LINK (otwiera te sama liste/wyjazd w aplikacji), a obrazek
// powstaje ze zrzutu pelnego ekranu.

// Stopka karty: kto to zrobil + znak marki. Wspolna dla obu szablonow, zeby karta
// zawsze konczyla sie tak samo i dalo sie ja rozpoznac po jednym elemencie.
function Footer({ avatars, label, sub, tone }: {
  avatars: (string | null)[]; label: string; sub?: string; tone: "light" | "peach";
}) {
  return (
    <div
      className={`absolute left-5 right-5 h-[74px] rounded-2xl flex items-center gap-3 px-4 ${tone === "light" ? "bg-white" : "bg-[#FCEDE3]"}`}
      style={{ bottom: "max(24px, calc(env(safe-area-inset-bottom) + 12px))" }}
    >
      <div className="flex -space-x-2 shrink-0">
        {avatars.slice(0, 3).map((a, i) => (
          <img key={i} src={avatarSrc(a)} alt="" className="h-8 w-8 rounded-full object-cover bg-orange-100 ring-2 ring-white" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-foreground truncate">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <span aria-hidden className="block h-6 w-6 shrink-0" style={{
        backgroundColor: "#F75708",
        WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }} />
    </div>
  );
}

// Arkusz: naglowek + podglad + kanaly. Karta (children) jest zaprojektowana na CALY ekran, wiec
// w podgladzie skalujemy ja transformem - dzieki temu miniatura jest co do piksela tym samym, co
// user zobaczy po rozwinieciu, bez drugiego zestawu rozmiarow do utrzymania.
type StripItem = { name: string; photo?: string | null; icon: string; verdict?: string | null; category?: string | null };

function ShareSheet({ children, onClose, onShare, shareUrl, shareTitle, strip, stripLabel, plainPreview }: {
  children: React.ReactNode;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
  shareTitle: string;
  /** Miejsca pokazywane pod podgladem (na razie tylko wyjazd - listy sa w projektowaniu). */
  strip?: StripItem[];
  stripLabel?: string;
  /** Podglad renderowany 1:1 (karta z eksploracji), a nie jako pomniejszony plakat 9:16. */
  plainPreview?: boolean;
}) {
  const { t } = useTranslation("sharing");
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [full, setFull] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = slotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / window.innerWidth, r.height / window.innerHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Pelny ekran = sama karta, bez zadnego chrome poza krzyzykiem. To jest kadr do zrzutu.
  if (full) {
    return (
      <div className="fixed inset-0 z-[96] animate-in fade-in duration-200">
        {children}
        <button onClick={() => setFull(false)} aria-label={t("common:buttons.close")}
          className="absolute right-3 h-9 w-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  const targets = shareUrl
    ? buildShareTargets({
        url: shareUrl,
        title: shareTitle,
        onSystemShare: () => onShare?.(),
        onCopied: () => toast.success("Skopiowano link"),
      })
    : [];

  return (
    // Zolte tlo + naglowek Sigmar wg makiety Nat (Figma "[NEW] Ekrany" -> "Udostępnianie
    // wyjazdów oraz list" -> "Akcja: Udostępnij - Wyjazdy", 2026-09-08). Ekran ma wygladac jak
    // czesc marki, a nie jak systemowy arkusz - to on ma zachecac do wyslania.
    <div className="fixed inset-0 z-[95] bg-spontaway-yellow flex flex-col animate-in fade-in duration-200 overflow-y-auto">
      <div className="shrink-0 flex items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-1">
        <button onClick={onClose} aria-label={t("common:buttons.close")}
          className="h-9 w-9 rounded-full flex items-center justify-center active:scale-90 transition-transform">
          <X className="h-5 w-5 text-spontaway-brown" />
        </button>
        <p className="flex-1 text-center font-brand text-[26px] leading-none text-spontaway-orange pr-9">{t("share.share")}</p>
      </div>

      <div ref={slotRef} className="flex-1 min-h-[280px] flex items-center justify-center px-6 py-3">
        {/* Podglad to TA SAMA karta, co w eksploracji (prosba Nat 2026-09-08) - user ma zobaczyc
            dokladnie to, co zobaczy odbiorca, a nie osobny plakat. Dlatego renderujemy ja
            w naturalnym rozmiarze, bez pomniejszania calego ekranu. */}
        {plainPreview ? (
          // Karta nachodzila na divider "Dzień 1" i pasek miejsc (zgloszenie Nat 2026-09-08):
          // przy sztywnych 520 px nie miescila sie w slocie i wylewala na to, co pod nia.
          // Teraz wysokosc idzie od EKRANU, a szerokosc od proporcji karty - dzieki temu kadr
          // z eksploracji zostaje ten sam, tylko mniejszy, i mniejszy telefon nie psuje ukladu.
          <div className="flex justify-center pb-3">
            {/* Szerokosc dobrana pod WIERSZ AUTORA: przy 250 px "@berd · Gdańsk · 5 miejsc"
                sciskalo sie do "@ · G · 5 miejsc" (zlapane na zrzucie). Wysokosc idzie od
                ekranu, zeby na mniejszym telefonie karta nie wchodzila na pasek miejsc. */}
            <div className="w-[min(78vw,310px)]">{children}</div>
          </div>
        ) : scale > 0 && (
          <button onClick={() => setFull(true)} aria-label={t("share.open_fullscreen")}
            className="relative rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 active:scale-[0.98] transition-transform"
            style={{ width: window.innerWidth * scale, height: window.innerHeight * scale }}>
            <div className="pointer-events-none origin-top-left"
              style={{ width: window.innerWidth, height: window.innerHeight, transform: `scale(${scale})` }}>
              {children}
            </div>
            <span className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
              <Maximize2 className="h-4 w-4 text-white" strokeWidth={2.2} />
            </span>
          </button>
        )}
      </div>

      {/* Pasek miejsc z wyjazdu - to on tlumaczy, CO wysylasz. Przewijany w poziomie, bo
          wazniejsze jest pokazanie pierwszych przystankow niz zmieszczenie wszystkich. */}
      {strip && strip.length > 0 && (
        <div className="shrink-0 pb-1">
          <div className="flex items-center gap-2 px-5 pb-2">
            <span className="h-4 w-[3px] rounded-full bg-spontaway-orange" />
            <p className="font-brand text-[15px] leading-none text-spontaway-orange">{stripLabel}</p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {strip.map((it, i) => (
              <div key={`${it.name}-${i}`} className="flex w-[264px] shrink-0 items-center gap-3 rounded-3xl bg-white px-3 py-3">
                <div className="relative h-[80px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-[#fcede3]">
                  {it.photo
                    ? <img src={it.photo} alt="" className="h-full w-full object-cover" />
                    : <img src={it.icon} alt="" className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2" />}
                  <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-[10px] bg-spontaway-orange px-1 text-[10px] font-black leading-none text-white">{i + 1}</span>
                </div>
                <div className="flex h-[80px] min-w-0 flex-1 flex-col justify-between py-0.5">
                  <p className="line-clamp-2 text-[14px] font-bold leading-[1.19] text-black">{it.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    {it.verdict
                      ? <span className="truncate rounded-full bg-spontaway-yellow px-2.5 py-1 text-[11px] font-medium text-spontaway-brown">{it.verdict}</span>
                      : <span />}
                    {it.category && <span className="shrink-0 text-[11px] font-medium text-[#666]">{it.category}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {targets.length > 0 && (
        <div className="shrink-0 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <p className="font-brand text-[18px] leading-none text-spontaway-orange pb-3">{t("share.link_heading")}</p>
          {/* Rzad przewijany w poziomie zamiast siatki 4-kolumnowej: kanalow przybywa, a siatka
              lamalaby sie na kolejne rzedy i spychala podglad karty poza ekran. */}
          <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {targets.map((tg) => (
              <div key={tg.key} className="w-[76px] shrink-0"><ShareTargetButton target={tg} /></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Karta LISTY: siatka miejsc + licznik "ile jeszcze". */
export function ShareCardList({ title, city, items, author, avatar, onClose, onShare, shareUrl }: {
  title: string;
  city?: string | null;
  items: any[];
  author: string;
  avatar?: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
}) {
  const { t } = useTranslation("sharing");
  const shown = items.slice(0, 5);
  const rest = Math.max(0, items.length - shown.length);
  const word = items.length === 1 ? "miejsce" : items.length < 5 ? "miejsca" : "miejsc";
  return (
    <ShareSheet onClose={onClose} onShare={onShare} shareUrl={shareUrl} shareTitle={title}>
          <div className="relative h-full w-full overflow-hidden bg-[#FCEDE3]">
            <div className="px-6" style={{ paddingTop: "max(64px, calc(env(safe-area-inset-top) + 44px))" }}>
              <p className="text-[12px] font-bold tracking-wide text-[#C58A66]">{t("card.list_label")}</p>
              <p className="text-[34px] font-black leading-[1.06] text-foreground mt-2 line-clamp-3">{title}</p>
              <p className="text-[15px] font-semibold text-[#8A6A57] mt-2.5">
                {[city, `${items.length} ${word}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {/* Kafelki = dowod, ze lista ma tresc. Nazwa pod kazdym, zeby dalo sie ja czytac
                takze bez zdjec (miejsce bez zdjecia dostaje ikone kategorii na peachy tle). */}
            <div className="grid grid-cols-3 gap-2.5 px-6 mt-7">
              {shown.map((it, i) => (
                <div key={it.id ?? i}>
                  <div className="rounded-xl overflow-hidden bg-white">
                    {/* tone="contrast": kafelek bez zdjecia lezy tu na peachowym tle karty, wiec
                        domyslny peachy zlewalby sie z nim w jedna plame. */}
                    <PlaceTile tile={it} aspect="aspect-square" tone="contrast" />
                  </div>
                  <p className="text-[11.5px] font-semibold text-[#5C4136] mt-1.5 leading-tight line-clamp-1">{it.place_name}</p>
                </div>
              ))}
              {rest > 0 && (
                <div className="aspect-square rounded-xl bg-[#F6D9C6] flex items-center justify-center">
                  <span className="text-[28px] text-[#F75708]" style={{ fontFamily: "Sigmar, system-ui, sans-serif" }}>+{rest}</span>
                </div>
              )}
            </div>
            <Footer avatars={[avatar ?? null]} label={author} sub={t("share.save_in_app")} tone="light" />
          </div>
    </ShareSheet>
  );
}

/** Karta WYJAZDU: okladka + ponumerowane przystanki + uczestnicy. */
export function ShareCardTrip({ title, city, pins, cover, onClose, onShare, shareUrl, routeId, authorName, authorAvatar, participants, tags, mapPins }: {
  title: string;
  city?: string | null;
  pins: any[];
  cover?: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
  /** Dane, zeby podglad pokazywal DOKLADNIE te karte, ktora widac w eksploracji. */
  routeId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  participants?: (string | null)[];
  tags?: string[];
  mapPins?: { latitude: number; longitude: number }[];
}) {
  const { t } = useTranslation("sharing");
  // Pasek miejsc pod podgladem: pierwsze przystanki z werdyktem i kategoria.
  const strip = pins.slice(0, 8).map((p: any) => ({
    name: p.place_name ?? "",
    photo: thumbUrl(resolveStored(p.photo_url ?? p.image_url ?? (Array.isArray(p.images) ? p.images[0] : null)), 160),
    icon: categoryIconSrc(p.category ?? null),
    verdict: (Array.isArray(p.tags) ? p.tags : []).find((tg: string) => verdictOf(tg))
      ? localizeTag((Array.isArray(p.tags) ? p.tags : []).find((tg: string) => verdictOf(tg))!)
      : null,
    // "other" to wartosc techniczna z bazy, nie etykieta - bez tego na karcie widac
    // dosłownie "other" (zlapane na zrzucie).
    category: p.category && p.category !== "other" ? subcategoryLabelLocalized(p.category) : null,
  }));

  return (
    // Podglad = karta z EKSPLORACJI, nie osobny plakat (prosba Nat 2026-09-08). Autor ma
    // zobaczyc dokladnie to, co zobaczy odbiorca - okladka w calosci, awatary, tagi i licznik.
    <ShareSheet onClose={onClose} onShare={onShare} shareUrl={shareUrl} shareTitle={title}
      strip={strip} stripLabel={t("share.first_day")} plainPreview>
      <TrasaBigCard
        id={routeId}
        photo={resolveStored(cover ?? null) ?? null}
        city={city}
        placeCount={pins.length}
        title={title}
        tags={tags ?? []}
        pins={mapPins ?? []}
        onOpen={() => {}}
        authorName={authorName}
        authorAvatar={authorAvatar}
        participants={participants ?? []}
        snap={false}
        heightClass="h-[min(40dvh,370px)]"
        minHeightClass=""
      />
    </ShareSheet>
  );
}
