import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { useState } from "react";
import { Minimize2 } from "lucide-react";
import RouteMap from "@/components/RouteMap";
import { haptics } from "@/hooks/useHaptics";
import type { ListTheme } from "@/lib/listThemes";

// KAFELKI WYJAZDU I LISTY w Eksploracji (makieta Nat 2026-09-13). Jedna kolumna, kafelek na
// cala szerokosc (`size="feed"`); wariant "grid" (2 kolumny, mniejsza typografia) zostaje
// na przyszlosc - do 2026-09-13 rysowal zakladke "Glowna", ktora Nat zdjela z paska.
//
//  - WYJAZD = okladka ZAWSZE 9:16 (decyzja Nat 2026-09-13: kazdy kafelek tej samej wysokosci,
//    zdjecie kadrowane object-cover; wczesniej naturalne proporcje przyciete do 9:16 - 4:5,
//    przez co kafelki mialy rozne wysokosci), pigulka autora (awatar + nazwa) w lewym gornym
//    rogu, mini-mapa trasy w prawym, u dolu tytul i chipy (liczba miejsc, miasto, dni).
//    Bez karuzeli zdjec (usunieta 2026-09-13 - galeria zyje w widoku wyjazdu).
//  - LISTA = kolorowy kafelek (tlo z palety marki, listThemes.ts) z mini-siatka miejsc
//    (3 kolumny, do 6 kafelkow, "+N" dla reszty), pod nia autor, tytul i chipy (odwiedzone
//    przez autora / liczba miejsc, miasto). W feedzie chip kategorii mini-kafelka to napis
//    (kafelek ~105 px); na siatce - ikona (kafelek ~46 px, "Restauracja" konczylo jako "Rest…").

export type TileSize = "grid" | "feed";

export type GridPlace = { name: string; category: string | null; photo: string | null };

export type GridItem = {
  kind: "trip" | "list";
  id: string;
  title: string;
  cover: string | null;
  /** Chip lokalizacji: miasto, a gdy go brak - kraje. */
  where: string;
  authorName: string;
  authorAvatar: string | null;
  authorId: string | null;
  /** Ramka awatara autora (profiles.avatar_frame / _color). */
  authorFrame: string | null;
  authorFrameColor: string | null;
  /** false = wyjazd udostepniony anonimowo: bez pigulki autora. */
  showAuthor: boolean;
  at: number;                 // sort: najnowsze na gorze
  placesCount: number;
  /** Wyjazd: liczba dni (start_date..end_date) i mini-mapa trasy. */
  days: number | null;
  mapUrl: string | null;
  /** Wyjazd: piny z wspolrzednymi - do ROZWINIETEJ mapy po tapnieciu w miniature. */
  pins?: { latitude?: number | null; longitude?: number | null; place_name?: string | null }[];
  /** Lista: tlo z palety i pierwsze miejsca do mini-siatki. */
  theme: ListTheme | null;
  places: GridPlace[];
  /** Lista: ile miejsc odwiedzil jej AUTOR (chip "8/15", prosba Nat 2026-09-13). */
  visitedCount?: number;
};

/** Mini-siatka listy: 3 kolumny, dwa rzedy. Przy wiecej niz 6 miejscach ostatni kafelek to "+N". */
export const LIST_TILES = 6;

// Okladka kafelka: miniatura (.thumb, ~50 kB) -> oryginal -> placeholder. Ten sam lancuch,
// co w PlacePhoto; bez niego kafelek bral oryginal (1-3 MB) i przy bledzie zostawal z ikona "?".
function GridCover({ url, thumb }: { url: string | null; thumb: number }) {
  const { src, failed, onError } = useImageWithFallback(url, thumb);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={onError} draggable={false} className="absolute inset-0 h-full w-full object-cover" />;
  }
  return (
    <span className="absolute inset-0 block">
      <span aria-hidden className="absolute inset-0 m-auto h-[42%] w-[42%]" style={{
        backgroundColor: "#EF9D78",
        WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }} />
    </span>
  );
}

/** Polprzezroczyste tlo elementow na kolorowym kafelku listy - biale na ciemnym tle, brazowe na jasnym. */
const tintBg = (ink: string) => (ink === "#FFFFFF" ? "rgba(255,255,255,0.22)" : "rgba(91,44,6,0.12)");

/** Chip na kafelku: polprzezroczysta pigulka z ikona i/lub tekstem. */
function Chip({ children, ink, dark, size }: { children: React.ReactNode; ink?: string; dark?: boolean; size: TileSize }) {
  const dims = size === "feed" ? "h-[26px] px-2.5 text-[12px]" : "h-[22px] px-2 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold leading-none ${dims} ${dark ? "bg-black/40 text-white backdrop-blur-sm" : ""}`}
      style={dark || !ink ? undefined : { backgroundColor: tintBg(ink), color: ink }}
    >
      {children}
    </span>
  );
}

/** Pigulka autora: awatar z ramka + nazwa. `tone` = pomarancz marki (na zdjeciu) albo
 *  polprzezroczysta w kolorze tekstu (na kolorowym tle listy). */
function AuthorPill({ it, tone, ink, size }: { it: GridItem; tone: "brand" | "tint"; ink?: string; size: TileSize }) {
  const feed = size === "feed";
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full font-bold leading-none ${feed ? "gap-2 py-1 pl-1 pr-3 text-[13px]" : "gap-1.5 py-[3px] pl-[3px] pr-2.5 text-[11px]"} ${tone === "brand" ? "bg-primary text-white shadow-sm" : ""}`}
      style={tone === "brand" || !ink ? undefined : { backgroundColor: tintBg(ink), color: ink }}
    >
      <FramedAvatar src={it.authorAvatar} frame={it.authorFrame} color={it.authorFrameColor} size={feed ? 24 : 20} imgClassName="ring-1 ring-white/70" />
      <span className="truncate">{it.authorName}</span>
    </span>
  );
}

// Mini-kafelek miejsca w kafelku listy: zdjecie (albo ikona kategorii na peachy tle), znaczek
// kategorii u gory i nazwa u dolu. Male, wiec sama nazwa (bez miasta).
//
// Znaczek kategorii na SIATCE to IKONA (Ikona__*.svg), nie napis jak w makiecie: kafelek ma
// ~46 px szerokosci, a "Restauracja" czy "Kawiarnia" nie mieszcza sie w nim nawet przy 7 px
// i koncza jako "Rest…". W FEEDZIE kafelek ma ~105 px, wiec napis wraca. Na kafelku bez zdjecia
// ikona jest juz na srodku, wiec znaczka-ikony nie dublujemy.
function MiniPlace({ place, size }: { place: GridPlace; size: TileSize }) {
  const feed = size === "feed";
  const { src, failed, onError } = useImageWithFallback(place.photo, feed ? 400 : 200);
  const hasPhoto = !!src && !failed;
  const cat = place.category ? subcategoryLabelLocalized(place.category) : null;
  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-[#fcede3] ${feed ? "rounded-xl" : "rounded-[10px]"}`} title={cat ?? undefined}>
      {hasPhoto ? (
        <>
          <img src={src!} alt="" loading="lazy" onError={onError} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={categoryIconSrc(place.category)} alt="" draggable={false} className="w-[42%] opacity-90" />
        </div>
      )}
      {cat && feed ? (
        <span className={`absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-full px-2 py-[3px] text-[9px] font-bold leading-none ${hasPhoto ? "bg-black/45 text-white backdrop-blur-sm" : "bg-white/75 text-[#5B2C06]"}`}>
          {cat}
        </span>
      ) : place.category && hasPhoto ? (
        <span aria-label={cat ?? undefined} className="absolute left-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/90 shadow-sm">
          <img src={categoryIconSrc(place.category)} alt="" draggable={false} className="h-[11px] w-[11px]" />
        </span>
      ) : null}
      <span className={`absolute inset-x-1 bottom-1 line-clamp-2 font-semibold leading-[1.15] ${feed ? "inset-x-1.5 bottom-1.5 text-[11px]" : "text-[9px]"} ${hasPhoto ? "text-white drop-shadow-sm" : "text-[#5B2C06]"}`}>
        {place.name}
      </span>
    </div>
  );
}

export function TripTile({ it, size = "feed" }: { it: GridItem; size?: TileSize }) {
  const { t } = useTranslation("homefeed");
  const feed = size === "feed";
  // Mini-mapa ROZWIJA sie po tapnieciu (jak na starej karcie TrasaBigCard; przywrocone na
  // prosbe Nat 2026-09-13): maly kwadrat w rogu -> duzy prostokat z zywa mapa (RouteMap, te
  // same markery co w wyjezdzie), ponowny tap zwija. Zywa mapa montuje sie DOPIERO po
  // rozwinieciu - w feedzie sa dziesiatki kafelkow, kazda mapa Google to osobna instancja.
  const [mapExpanded, setMapExpanded] = useState(false);
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };
  return (
    <div className={`relative w-full overflow-hidden bg-[#fcede3] ${feed ? "rounded-3xl" : "rounded-[20px]"}`}>
      {/* Pudelko 9:16 - kazda okladka ma te same proporcje, zdjecie jest kadrowane. */}
      <div className="relative w-full aspect-[9/16]">
        <GridCover url={it.cover} thumb={feed ? 800 : 400} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      {it.showAuthor && !mapExpanded && (
        <div className={`pointer-events-none absolute z-[2] ${feed ? "left-3 top-3 max-w-[calc(100%-100px)]" : "left-2 top-2 max-w-[calc(100%-76px)]"}`}>
          <AuthorPill it={it} tone="brand" size={size} />
        </div>
      )}
      {it.mapUrl && (
        <div
          data-no-swipe
          onClick={stop}
          className={`absolute z-[3] overflow-hidden rounded-xl border-2 border-white bg-muted shadow-md transition-all duration-300 ease-out ${
            mapExpanded ? "left-3 right-3 top-3 h-[62%]" : feed ? "right-3 top-3 h-[72px] w-[72px]" : "right-2 top-2 h-14 w-14"
          }`}
        >
          {mapExpanded ? (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <RouteMap pins={(it.pins ?? []) as any} className="h-full w-full" showRoute={false} />
              </div>
              <button onClick={(e) => { stop(e); haptics.selection(); setMapExpanded(false); }}
                aria-label={t("card.collapse_map")} className="absolute inset-0 active:opacity-95 transition-opacity" />
              <span className="pointer-events-none absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md">
                <Minimize2 className="h-4 w-4 text-foreground" strokeWidth={2.2} />
              </span>
            </>
          ) : (
            <button onClick={(e) => { stop(e); haptics.selection(); setMapExpanded(true); }}
              aria-label={t("card.show_map")} className="absolute inset-0 active:scale-[0.99] transition-transform">
              <img src={it.mapUrl} alt="" aria-hidden loading="lazy" draggable={false} className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.parentElement!.style.display = "none"; }} />
            </button>
          )}
        </div>
      )}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] ${feed ? "p-4 pb-5" : "p-3 pb-[18px]"}`}>
        <p className={`line-clamp-2 font-bold leading-[1.1] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] ${feed ? "text-[24px]" : "text-[19px]"}`}>{it.title}</p>
        <div className={`flex flex-wrap ${feed ? "mt-2.5 gap-1.5" : "mt-2 gap-1"}`}>
          <Chip dark size={size}><MapPin className={feed ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.4} />{it.placesCount}</Chip>
          {it.where && <Chip dark size={size}>{it.where}</Chip>}
          {it.days != null && <Chip dark size={size}>{t("grid.days", { count: it.days })}</Chip>}
        </div>
      </div>
    </div>
  );
}

export function ListTile({ it, size = "feed" }: { it: GridItem; size?: TileSize }) {
  const theme = it.theme!;
  const feed = size === "feed";
  const overflow = it.placesCount > LIST_TILES ? it.placesCount - (LIST_TILES - 1) : 0;
  const shown = overflow ? it.places.slice(0, LIST_TILES - 1) : it.places.slice(0, LIST_TILES);
  return (
    <div className={`w-full ${feed ? "rounded-3xl p-3.5" : "rounded-[20px] p-2.5"}`} style={{ backgroundColor: theme.bg, color: theme.ink }}>
      <div className={`grid grid-cols-3 ${feed ? "gap-2" : "gap-1.5"}`}>
        {shown.map((p, i) => <MiniPlace key={`${p.name}-${i}`} place={p} size={size} />)}
        {overflow > 0 && (
          <div className={`flex aspect-[2/3] items-center justify-center ${feed ? "rounded-xl" : "rounded-[10px]"}`} style={{ backgroundColor: tintBg(theme.ink) }}>
            <span className={`font-brand leading-none ${feed ? "text-[24px]" : "text-[17px]"}`}>+{overflow}</span>
          </div>
        )}
      </div>
      {it.showAuthor && (
        <div className={`flex ${feed ? "mt-3.5" : "mt-2.5"}`}>
          <AuthorPill it={it} tone="tint" ink={theme.ink} size={size} />
        </div>
      )}
      <p className={`line-clamp-2 font-bold leading-[1.15] ${feed ? "mt-2.5 text-[22px]" : "mt-1.5 text-[17px]"}`}>{it.title}</p>
      <div className={`flex flex-wrap ${feed ? "mt-2.5 gap-1.5" : "mt-1.5 gap-1"}`}>
        {/* "odwiedzone przez autora / wszystkie" - sama liczba miejsc, gdy autor nic nie odhaczyl
            (wiekszosc list; "0/15" wygladaloby jak brak, a nie jak informacja). */}
        <Chip ink={theme.ink} size={size}>
          <MapPin className={feed ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.4} />
          {it.visitedCount ? `${it.visitedCount}/${it.placesCount}` : it.placesCount}
        </Chip>
        {it.where && <Chip ink={theme.ink} size={size}>{it.where}</Chip>}
      </div>
    </div>
  );
}

// Kafelek z obsluga tapniecia. `className` = dodatkowe klasy wrappera (np. snap w feedzie).
export function GridTile({ it, onOpen, size = "feed", className = "" }: { it: GridItem; onOpen: () => void; size?: TileSize; className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <div
        role="button" tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="group block w-full text-left active:opacity-90 transition-opacity"
      >
        {it.kind === "trip" ? <TripTile it={it} size={size} /> : <ListTile it={it} size={size} />}
      </div>
    </div>
  );
}
