import { Globe2, Lock, MapPin } from "lucide-react";
import { BrandStar } from "@/components/BrandStar";
import { BrandBookmark } from "@/components/BrandBookmark";
import { useTranslation } from "react-i18next";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { avatarSrc } from "@/lib/avatar";
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

/** Jak kafelek KOLEKCJI przedstawia ludzi.
 *  - "pill"    = pigulka autora (awatar z nakladka + nazwa + nick). Eksploracja, udostepnianie.
 *  - "avatars" = sam klaster awatarow bez nazw i bez nakladek. Profil wlasny i publiczny
 *                (prosba Nat 2026-09-17) - tam nazwa autora stoi juz w naglowku ekranu. */
export type PeopleStyle = "pill" | "avatars";

/** `isNew` = miejsce dodane przez autora od ostatniego obejrzenia kolekcji przez TEGO usera
 *  (baza: saved_collections.seen_item_count). Dostaje brandowa gwiazdke na okladce. */
export type GridPlace = { name: string; category: string | null; photo: string | null; isNew?: boolean };

export type GridItem = {
  kind: "trip" | "list";
  id: string;
  title: string;
  cover: string | null;
  /** Chip lokalizacji: miasto, a gdy go brak - kraje. */
  where: string;
  authorName: string;
  /** `@nick` pokazywany OBOK nazwy (prosba Nat 2026-09-15, kafelek kolekcji). Gdy go nie ma,
   *  pigulka pokazuje sam `authorName` - tak zostaja kafelki wyjazdow. */
  authorHandle?: string | null;
  authorAvatar: string | null;
  authorId: string | null;
  /** Ramka awatara autora (profiles.avatar_frame / _color). */
  authorFrame: string | null;
  authorFrameColor: string | null;
  /** Wspoltworcy kolekcji (bez wlasciciela) - nachodzace awatary obok pigulki autora.
   *  Bez tego na profilu publicznym nie bylo widac, ze kolekcje wspoltworzy ktos jeszcze
   *  (prosba Nat 2026-09-15). Pusto = kolekcja jednoosobowa ALBO ogladajacy nie ma prawa
   *  czytac skladu (RLS) - w obu przypadkach nie pokazujemy nic. */
  coAuthors?: { id: string; username: string | null; avatar_url: string | null; avatar_frame?: string | null; avatar_frame_color?: string | null }[];
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
  /** Lista: ile miejsc doszlo od ostatniego obejrzenia (0 = brak sygnalu). */
  newCount?: number;
  /** Lista: ile osob zapisalo kolekcje (zakladka + liczba w prawym dolnym rogu). Podawane
   *  TYLKO tam, gdzie jest to statystyka wlasnej tresci ("Moje kolekcje" na profilu) -
   *  w eksploracji kafelek cudzej kolekcji jej nie pokazuje. 0 = nie renderujemy nic. */
  savesCount?: number;
  /** Lista: prywatnosc kolekcji - klodka albo globus obok licznika zapisow (prosba Nat
   *  2026-09-17). ⛔ `undefined` = NIE renderujemy nic, i tak ma byc w eksploracji oraz
   *  w "Zapisanych": tam wszystko, co widac, jest z definicji publiczne, wiec globus na
   *  kazdym kafelku bylby czystym szumem. Pole podaje wylacznie wlasny profil, gdzie stan
   *  jest zmienny i nalezy do ogladajacego. */
  isPublic?: boolean;
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
function Chip({ children, ink, dark, size, className = "" }: { children: React.ReactNode; ink?: string; dark?: boolean; size: TileSize; className?: string }) {
  // Feed: rozmiary z makiety Nat 2026-09-13 ("Majówka 2025"): chip ~28 px z tekstem 14 px.
  const dims = size === "feed" ? "h-[30px] px-3 text-[14px]" : "h-[22px] px-2 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold leading-none ${dims} ${dark ? "bg-black/40 text-white backdrop-blur-sm" : ""} ${className}`}
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
  // ⚠️ Czesc zapytan podstawia username jako nazwe, gdy autor nie ma imienia
  // (`author_name: first_name || username`). Bez tego porownania pigulka pokazywalaby
  // "nyszje @nyszje". Nick zostaje tylko wtedy, gdy realnie wnosi cos ponad nazwe.
  const bare = (s: string) => s.replace(/^@/, "").trim().toLowerCase();
  const handle = it.authorHandle && bare(it.authorHandle) !== bare(it.authorName) ? it.authorHandle : null;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full font-bold leading-none ${feed ? "gap-2 py-1 pl-1 pr-3 text-[13px]" : "gap-1.5 py-[3px] pl-[3px] pr-2.5 text-[11px]"} ${tone === "brand" ? "bg-primary text-white shadow-sm" : ""}`}
      style={tone === "brand" || !ink ? undefined : { backgroundColor: tintBg(ink), color: ink }}
    >
      <FramedAvatar src={it.authorAvatar} frame={it.authorFrame} color={it.authorFrameColor} size={feed ? 24 : 20} imgClassName="ring-1 ring-white/70" />
      {/* Nazwa i @nick obok siebie (kolekcje). Gdy autor nie ma imienia, `authorName` jest
          pusty i zostaje sam nick - zeby nie bylo pustego miejsca ani nicku dwa razy. */}
      <span className="truncate">{it.authorName || it.authorHandle}</span>
      {!!handle && !!it.authorName && (
        <span className="shrink-0 font-semibold opacity-70">{handle}</span>
      )}
    </span>
  );
}

/** Ile awatarow miesci sie w klastrze. Piaty i dalsi ida w licznik obok. */
const CLUSTER_SHOWN = 4;

/** Srodki awatarow w ulamkach pudelka - OSOBNY uklad na kazda liczbe osob. Sztywna siatka
 *  2x2 przy dwoch osobach zostawialaby pusty dolny rzad i klaster czytalby sie jako obciety;
 *  przy trzech - jako brakujacy czwarty. */
const CLUSTER_POS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.74]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
};

/** AUTOR I WSPOLTWORCY JAKO SAME AWATARY (prosba Nat 2026-09-17, wzor: klaster tworcow przy
 *  filmie na YouTube). Uklad TYLKO na profilach - wlasnym i publicznym.
 *
 *  Dlaczego bez nazwy autora: na profilu patrzysz wlasnie na jego naglowek, wiec pigulka
 *  z imieniem i nickiem powtarzala to, co stoi dwa centymetry wyzej, a zabierala pol rzedu
 *  chipow. W EKSPLORACJI pigulka ZOSTAJE - tam autor jest informacja, nie powtorzeniem.
 *
 *  Autor jest PIERWSZY i na wierzchu; dalej wspoltworcy w kolejnosci z zapytania.
 *  Kolekcja jednoosobowa dostaje jeden awatar na cale pudelko, wiec uklad dziala tak samo
 *  dla kolekcji wlasnej i wspolnej - nie ma osobnego przypadku do utrzymania.
 *
 *  Awatary sa BEZ NAKLADEK (prosba Nat): cztery ramki po 24 px, kazda z wlasnymi gwiazdkami
 *  i kolorem, zlewaly sie w kolorowa plame i to one rzucaly sie w oczy zamiast twarzy.
 *  Nakladka zostaje wszedzie, gdzie awatar stoi sam i ma na nia rozmiar.
 */
function PeopleCluster({ it, theme, size }: { it: GridItem; theme: ListTheme; size: TileSize }) {
  const feed = size === "feed";
  const crew = [
    { id: it.authorId ?? "owner", avatar: it.authorAvatar },
    ...(it.coAuthors ?? []).map((c) => ({ id: c.id, avatar: c.avatar_url })),
  ];
  const shown = crew.slice(0, CLUSTER_SHOWN);
  const extra = crew.length - shown.length;
  // ⚠️ Kolekcja JEDNOOSOBOWA dostaje MNIEJSZE pudelko (32 px zamiast 44). Awatar na cale
  // 44 px byl ciezszy niz cztery twarze w klastrze, a to wlasnie kolekcja jednoosobowa jest
  // przypadkiem domyslnym: w "Moje kolekcje" kazdy kafelek pokazywalby moje wlasne zdjecie
  // w rozmiarze wiekszym niz gdziekolwiek indziej na tym ekranie. Sprawdzone renderem
  // w WebKit na trzech motywach kolekcji.
  const solo = shown.length === 1;
  const box = solo ? (feed ? 32 : 26) : (feed ? 44 : 34);
  const pos = CLUSTER_POS[shown.length] ?? CLUSTER_POS[CLUSTER_SHOWN];
  // Obwodka w kolorze KAFELKA, nie biala: to ona rozdziela sasiadujace twarze, a biel na
  // kremowym czy piaskowym motywie nie rozdzielalaby niczego.
  const av = solo ? box : Math.round(box * 0.56);
  return (
    <span className={`flex shrink-0 items-center ${feed ? "gap-1.5" : "gap-1"}`}>
      <span className="relative block shrink-0" style={{ width: box, height: box }}>
        {shown.map((p, i) => (
          <img
            key={p.id}
            src={avatarSrc(p.avatar)}
            alt=""
            draggable={false}
            className="absolute rounded-full bg-orange-100 object-cover"
            style={{
              width: av, height: av,
              left: `${pos[i][0] * 100}%`, top: `${pos[i][1] * 100}%`,
              transform: "translate(-50%, -50%)",
              zIndex: shown.length - i,
              boxShadow: shown.length > 1 ? `0 0 0 2px ${theme.bg}` : undefined,
            }}
          />
        ))}
      </span>
      {/* Piata i dalsze osoby: sam licznik. Bez niego kolekcja dwunastu osob wygladalaby
          dokladnie tak samo jak czteroosobowa. */}
      {extra > 0 && (
        <span className={`inline-flex items-center rounded-full px-2 font-bold leading-none ${feed ? "h-[22px] text-[12px]" : "h-[18px] text-[10px]"}`}
          style={{ backgroundColor: tintBg(theme.ink), color: theme.ink }}>
          {"+" + extra}
        </span>
      )}
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
    // Dwie warstwy: zewnetrzna NIE przycina (gwiazdka "nowe miejsce" wychodzi poza rog),
    // wewnetrzna przycina zdjecie do zaokraglonego kadru.
    <div className="relative">
    {/* Lekki cien (prosba Nat 2026-09-15): odkleja kafelek od kolorowego tla kolekcji.
        Siedzi na WARSTWIE PRZYCINAJACEJ, nie na zewnetrznej - cien rysuje sie na zewnatrz
        elementu, wiec `overflow-hidden` go nie zjada, a zewnetrzna warstwa musi zostac
        czysta, zeby gwiazdka "nowe miejsce" mogla z niej wystawac bez wlasnego cienia. */}
    <div className={`relative aspect-[2/3] overflow-hidden bg-[#fcede3] shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${feed ? "rounded-xl" : "rounded-[10px]"}`} title={cat ?? undefined}>
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
    {/* NOWE miejsce: brandowa gwiazdka NACHODZACA na rog okladki (prosba Nat 2026-09-14).
        Uczy, ze autor cos tu dolozyl - ta sama gwiazdka co przy wyroznieniach, wiec znak
        jest juz userowi znany. Inline svg (BrandStar), NIE maska CSS - patrz CLAUDE.md. */}
    {place.isNew && (
      <span aria-hidden
        className={`absolute z-10 flex items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.28)] ${feed ? "-right-2 -top-2 h-7 w-7" : "-right-1.5 -top-1.5 h-5 w-5"}`}>
        <BrandStar className={`text-primary ${feed ? "h-4 w-4" : "h-3 w-3"}`} />
      </span>
    )}
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
      {/* Gradient od dolnej krawedzi CIEMNIEJSZY o ~20% (prosba Nat 2026-09-15): 75 -> 90 u dolu,
          30 -> 40 w srodku. Tytul w Inter Black lezy na nim, a nie na zdjeciu. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      {it.showAuthor && !mapExpanded && (
        <div className={`pointer-events-none absolute z-[2] ${feed ? "left-3 top-3 max-w-[calc(100%-136px)]" : "left-2 top-2 max-w-[calc(100%-76px)]"}`}>
          <AuthorPill it={it} tone="brand" size={size} />
        </div>
      )}
      {it.mapUrl && (
        <div
          data-no-swipe
          onClick={stop}
          className={`absolute z-[3] overflow-hidden rounded-xl border-2 border-white bg-muted shadow-md transition-all duration-300 ease-out ${
            mapExpanded ? "left-3 right-3 top-3 h-[62%]" : feed ? "right-3 top-3 h-[108px] w-[108px] rounded-2xl" : "right-2 top-2 h-14 w-14"
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
        {/* Feed: tytul 36 px i chipy 30 px (makieta Nat 2026-09-13 - wczesniej 24 / 26 px). */}
        <p className={`line-clamp-2 font-black leading-[1.05] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] ${feed ? "text-[36px] tracking-[-0.015em]" : "text-[19px]"}`}>{it.title}</p>
        <div className={`flex flex-wrap ${feed ? "mt-3.5 gap-2" : "mt-2 gap-1"}`}>
          <Chip dark size={size}><MapPin className={feed ? "h-4 w-4" : "h-3 w-3"} strokeWidth={2.4} />{it.placesCount}</Chip>
          {it.where && <Chip dark size={size}>{it.where}</Chip>}
          {it.days != null && <Chip dark size={size}>{t("grid.days", { count: it.days })}</Chip>}
        </div>
      </div>
    </div>
  );
}

export function ListTile({ it, size = "feed", people = "pill" }: { it: GridItem; size?: TileSize; people?: PeopleStyle }) {
  const { t } = useTranslation("homefeed");
  const theme = it.theme!;
  const feed = size === "feed";
  const overflow = it.placesCount > LIST_TILES ? it.placesCount - (LIST_TILES - 1) : 0;
  const shown = overflow ? it.places.slice(0, LIST_TILES - 1) : it.places.slice(0, LIST_TILES);
  return (
    // UKLAD (prosba Nat 2026-09-15): NAJPIERW podpis - autor, tytul i chipy - a POD NIM
    // okladki miejsc. Wczesniej siatka stala na gorze, a tekst pod nia. Przewijajac kolekcje
    // widac teraz od razu, czyja jest i o czym, zanim wzrok zejdzie na zdjecia.
    <div className={`w-full ${feed ? "rounded-3xl p-3.5" : "rounded-[20px] p-2.5"}`} style={{ backgroundColor: theme.bg, color: theme.ink }}>
      {/* Rzad 1: autor i WSZYSTKIE chipy na tej samej wysokosci (prosba Nat 2026-09-15).
          Wczesniej chipy mialy wlasny rzad pod tytulem - kafelek miał przez to trzy osobne
          linie podpisu nad zdjeciami. `items-center`, bo pigulka autora jest wyzsza od chipow. */}
      <div className={`flex flex-wrap items-center ${feed ? "gap-1.5" : "gap-1"}`}>
        {/* Profil = sam sklad w awatarach (PeopleCluster). Eksploracja = pigulka autora
            z nazwa, bo tam nie wiadomo, czyja to kolekcja. Patrz `PeopleStyle`. */}
        {it.showAuthor && (people === "avatars"
          ? <PeopleCluster it={it} theme={theme} size={size} />
          : <AuthorPill it={it} tone="tint" ink={theme.ink} size={size} />)}
        {/* Wspoltworcy: nachodzace awatary tuz przy autorze - na kafelku nie ma miejsca na
            handle, a chodzi o sam sygnal "to jest wspolna kolekcja". Pelne nazwiska sa
            w belce kolekcji i w arkuszu pod "+N". */}
        {people !== "avatars" && !!it.coAuthors?.length && (
          <span className="flex items-center -space-x-1.5">
            {it.coAuthors.slice(0, 3).map((c) => (
              <FramedAvatar key={c.id} src={c.avatar_url} frame={c.avatar_frame} color={c.avatar_frame_color}
                size={feed ? 24 : 20} imgClassName="ring-2 ring-white/80" />
            ))}
            {it.coAuthors.length > 3 && (
              <span className={`inline-flex items-center rounded-full pl-2.5 pr-2 font-bold ${feed ? "h-[24px] text-[12px]" : "h-[20px] text-[10px]"}`}
                style={{ backgroundColor: tintBg(theme.ink), color: theme.ink }}>
                {"+" + (it.coAuthors.length - 3)}
              </span>
            )}
          </span>
        )}
        {/* "odwiedzone przez autora / wszystkie". ZERO TEZ POKAZUJEMY jako "0/7" (prosba Nat
            2026-09-15) - do tej pory przy zerze zostawala sama liczba miejsc, przez co kafelek
            kolekcji, w ktorej autor jeszcze nigdzie nie byl, wygladal jakby licznika w ogole
            nie mial. Widok samej kolekcji (`HighlightChips`) pokazywal "0 / 7" od poczatku,
            wiec byla to niespojnosc, nie decyzja. Sama liczba zostaje WYLACZNIE tam, gdzie
            `visitedCount` nie zostal podany - wtedy nie wiemy, ile autor odwiedzil, a "0"
            twierdziloby, ze nic. */}
        <Chip ink={theme.ink} size={size}>
          <MapPin className={feed ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.4} />
          {it.visitedCount != null ? `${it.visitedCount}/${it.placesCount}` : it.placesCount}
        </Chip>
        {it.where && <Chip ink={theme.ink} size={size}>{it.where}</Chip>}
        {/* "Nowe miejsce!" - w tym samym rzedzie co reszta chipow, dociagniete do PRAWEJ
            krawedzi (prosba Nat 2026-09-14). Biale tlo, zeby odcinalo sie od kazdego z 9
            kolorow palety - reszta chipow jest przezroczysta. */}
        {/* PRAWA STRONA rzedu: "Nowe miejsce!" i licznik zapisow. Jedna wspolna grupa z `ml-auto`,
            zeby przy obu naraz dociagnela sie CALOSC - dwa osobne `ml-auto` w jednym rzedzie
            rozjechalyby je na dwie krawedzie. */}
        {(!!it.newCount || !!it.savesCount || it.isPublic != null) && (
          <span className={`ml-auto flex items-center ${feed ? "gap-1.5" : "gap-1"}`}>
            {!!it.newCount && (
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-white font-bold leading-none text-[#5B2C06] shadow-sm ${size === "feed" ? "h-[30px] px-3 text-[14px]" : "h-[22px] px-2 text-[11px]"}`}>
                <BrandStar className={`text-primary ${size === "feed" ? "h-[15px] w-[15px]" : "h-3 w-3"}`} />
                {t("new_place")}
              </span>
            )}
            {/* Prywatnosc OBOK licznika zapisow (prosba Nat 2026-09-17): klodka = tylko dla
                autora i wspoltworcow, globus = widoczna dla swiata. Stoi PRZED zakladka, wiec
                para czyta sie jako "prywatna, 3 zapisy" - i od razu tlumaczy, czemu licznik
                prywatnej kolekcji nie rosnie. Sam chip bez liczby, bo to stan, nie statystyka. */}
            {it.isPublic != null && (
              <Chip ink={theme.ink} size={size}>
                <span aria-label={it.isPublic ? t("stats.privacy_public") : t("stats.privacy_private")}>
                  {it.isPublic
                    ? <Globe2 className={feed ? "h-[15px] w-[15px]" : "h-3 w-3"} strokeWidth={2.4} />
                    : <Lock className={feed ? "h-[15px] w-[15px]" : "h-3 w-3"} strokeWidth={2.4} />}
                </span>
              </Chip>
            )}
            {/* Ile osob zapisalo kolekcje - ten sam tint co chipy, bo to informacja zwrotna dla
                autora, nie sygnal: nie krzyczy biela jak "Nowe miejsce!". Zero sie NIE renderuje
                (wiekszosci kolekcji nikt jeszcze nie zapisal, a rzad zer wygladalby jak zepsuty
                widok), wiec licznik podajemy wylacznie na "Moje kolekcje". */}
            {!!it.savesCount && (
              <Chip ink={theme.ink} size={size}>
                <BrandBookmark className={feed ? "h-[13px] w-[13px]" : "h-[10px] w-[10px]"} />
                <span aria-label={t("stats.saves_aria", { count: it.savesCount })}>{it.savesCount}</span>
              </Chip>
            )}
          </span>
        )}
      </div>
      {/* Tytul dostaje CALA szerokosc - licznik zapisow wrocil do rzedu chipow (prosba Nat
          2026-09-17). Stal tu od 2026-09-15, bo w rzedzie chipow wchodzil pod PIGULKE AUTORA
          i zabieral gore kafelka; na profilu pigulki juz tam nie ma (od 2026-09-17 jest klaster
          awatarow), wiec powod zniknal, a licznik wrocil miedzy pozostale liczby o kolekcji -
          liczbe miejsc i miasto. ⚠️ `savesCount` podajemy TYLKO na wlasnym profilu, wiec
          w eksploracji (gdzie pigulka autora zostaje) ten rzad sie nie zageszcza. */}
      <div className={feed ? "mt-2.5" : "mt-1.5"}>
        <p className={`line-clamp-2 font-bold leading-[1.15] ${feed ? "text-[22px]" : "text-[17px]"}`}>{it.title}</p>
      </div>
      <div className={`grid grid-cols-3 ${feed ? "mt-3.5 gap-2" : "mt-2.5 gap-1.5"}`}>
        {shown.map((p, i) => <MiniPlace key={`${p.name}-${i}`} place={p} size={size} />)}
        {overflow > 0 && (
          <div className={`flex aspect-[2/3] items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${feed ? "rounded-xl" : "rounded-[10px]"}`} style={{ backgroundColor: tintBg(theme.ink) }}>
            <span className={`font-brand leading-none ${feed ? "text-[24px]" : "text-[17px]"}`}>+{overflow}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Kafelek z obsluga tapniecia. `className` = dodatkowe klasy wrappera (np. snap w feedzie).
export function GridTile({ it, onOpen, size = "feed", className = "", people = "pill" }: { it: GridItem; onOpen: () => void; size?: TileSize; className?: string; people?: PeopleStyle }) {
  return (
    <div className={`w-full ${className}`}>
      <div
        role="button" tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="group block w-full text-left active:opacity-90 transition-opacity"
      >
        {it.kind === "trip" ? <TripTile it={it} size={size} /> : <ListTile it={it} size={size} people={people} />}
      </div>
    </div>
  );
}
