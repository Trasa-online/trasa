import { useState } from "react";
import { Bookmark, ChevronUp, Pencil, Trash2, CircleDashed, Heart } from "lucide-react";
import { API_BASE } from "@/lib/platform";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";

export type LatLng = { latitude?: number | null; longitude?: number | null };

// Mini mapka Google (statyczna) na okladce karty. Przez proxy /api/static-map (klucz server-side,
// 24h CDN cache). Pomaranczowe piny, POI/transit ukryte dla czystosci. null gdy brak wspolrzednych.
// Max 12 pinow (limit dlugosci URL).
export function buildMiniMapUrl(pins: LatLng[], size = "150x150"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 12);
  if (!pts.length) return null;
  const markers = pts
    .map((p) => `markers=size:tiny%7Ccolor:0xf9662b%7C${p.latitude},${p.longitude}`)
    .join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

// Wysokosc karty na EKSPLORACJI tak, by dol karty konczyl sie 16px NAD plywajacym BottomNavem.
// 150px = pt-safe(12) + topbar(52) + pt-3(12) + nav pill(58) + gap 16. Nav plywa
// max(16px, safe-bottom) nad krawedzia (patrz BottomNav pb), wiec odejmujemy to samo.
export const TRASA_CARD_H = "h-[calc(100dvh-150px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))]";

// Redesign 2026-07-24: pelnoekranowa karta feedu "Trasy" (immersyjny scroll, jeden ekran
// = jedna trasa/zestawienie). Zdjecie na cala kafle + gradient + opis na dole + prawy stack
// (mini-mapka, bookmark = zapisz, strzalka = otworz wizytowke). Bez swipe'a - naturalny scroll.
// Od 2026-08-30 ta sama karta jedzie na PROFILU (zakladka Wyjazdy) - tam bez mapki
// (showMap=false), nizsza (heightClass) i z akcjami wlasciciela (onEdit/onDelete) w prawym stacku.
export default function TrasaBigCard({
  id, photo, city, placeCount = 0, title, description, tags = [], pins = [],
  saved, onToggleSave, onOpen, authorName, authorAvatar, participants = [],
  showMap = true, heightClass = TRASA_CARD_H, snap = true, isDraft = false, onEdit, onDelete,
  onLike, liked,
}: {
  id: string;
  photo: string | null;
  city?: string | null;
  placeCount?: number;
  title: string;
  description?: string | null;
  tags?: string[];
  pins?: LatLng[];
  saved?: boolean;
  onToggleSave?: () => void;
  onOpen: () => void;
  authorName?: string | null;
  authorAvatar?: string | null;
  participants?: (string | null)[];   // awatary uczestnikow trasy grupowej (obok hosta)
  /** Mini mapka na okladce - na profilu wylaczona (prosba Nat 2026-08-30). */
  showMap?: boolean;
  /** Wysokosc kafla. Eksploracja = pelny ekran; profil = kafel 3:4 w liscie. */
  heightClass?: string;
  /** snap scroll - tylko w immersyjnym feedzie eksploracji. */
  snap?: boolean;
  /** Roboczy (nieopublikowany) wyjazd - plakietka na okladce. */
  isDraft?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Polubienie (profil publiczny). Bez tej propsy karta nie pokazuje serca. */
  onLike?: () => void;
  liked?: boolean;
}) {
  const miniMap = showMap ? buildMiniMapUrl(pins) : null;
  const bigMap = showMap ? buildMiniMapUrl(pins, "440x560") : null;
  const [mapExpanded, setMapExpanded] = useState(false);
  const countLabel = placeCount > 0
    ? `${placeCount} ${placeCount === 1 ? "miejsce" : placeCount < 5 ? "miejsca" : "miejsc"}`
    : null;
  return (
    <div className={`relative w-full shrink-0 rounded-3xl overflow-hidden bg-muted shadow-sm min-h-[420px] ${snap ? "snap-start snap-always" : ""} ${heightClass}`}>
      {photo ? (
        <img
          src={photo}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(id + "_fb"); }}
        />
      ) : (
        /* Brak okladki (praktycznie zawsze wyjazd ROBOCZY - opublikowany jej wymaga): peachy tlo
           ze znakiem spontaway w #EF9D78, jak puste stany (prosba Nat 2026-09-01). Wczesniej
           wchodzilo tu LOSOWE zdjecie z puli, przez co roboczy wyjazd udawal, ze ma tresc,
           ktorej nie ma. */
        <div className="absolute inset-0 bg-[#fcede3] flex items-center justify-center">
          <span aria-hidden className="block h-28 w-28" style={{ backgroundColor: "#EF9D78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </div>
      )}
      {/* Przyciemnienie pod tekstem. Na peachowym zastepniku slabsze i tylko przy dole - inaczej
          ciemny welon zjadalby cale tlo i znak przestawalby byc widoczny. */}
      <div className={`absolute inset-0 pointer-events-none ${photo ? "bg-gradient-to-t from-black/80 via-black/10 to-black/25" : "bg-gradient-to-t from-black/55 via-transparent to-transparent"}`} />
      {/* Tap na kafle = otworz wizytowke trasy/zestawienia */}
      <button onClick={onOpen} aria-label={title} className="absolute inset-0" />

      {/* Plakietka "Robocze" (profil) - lewy gorny rog, zamiast stopki starej karty. */}
      {isDraft && (
        <span className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
          <CircleDashed className="h-3.5 w-3.5" /> Robocze
        </span>
      )}

      {/* Podglad trasy: sama miniaturka mapki ROZWIJA sie na okladce (nie podmienia zdjecia).
          Maly kwadrat w prawym-gornym rogu -> po kliknieciu rosnie do duzego prostokata
          (od gory do tekstu z nazwa miasta + liczba miejsc); ponowny klik chowa do malego. */}
      {miniMap && (
        <button
          onClick={(e) => { e.stopPropagation(); haptics.selection(); setMapExpanded((v) => !v); }}
          aria-label={mapExpanded ? "Zwiń mapę" : "Pokaż mapę trasy"}
          className={`absolute z-20 rounded-2xl overflow-hidden ring-2 ring-white/85 shadow-lg bg-muted active:scale-[0.99] transition-all duration-300 ease-out ${mapExpanded ? "top-3 left-3 right-3 h-[62%]" : "top-3 right-3 h-24 w-24"}`}
        >
          <img
            src={mapExpanded && bigMap ? bigMap : miniMap} alt="" aria-hidden loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </button>
      )}

      {/* Prawy dolny stack: bookmark / akcje wlasciciela + rozwin (12px od prawej, 16px od dolu) */}
      <div className="absolute right-3 bottom-4 z-10 flex flex-col items-center gap-2.5">
        {onToggleSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            aria-label="Zapisz"
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <Bookmark className={`h-5 w-5 text-foreground ${saved ? "fill-current" : ""}`} strokeWidth={2} />
          </button>
        )}
        {onLike && (
          <button
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            aria-label={liked ? "Cofnij polubienie" : "Polub"}
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-red-500 text-red-500" : "text-foreground"}`} strokeWidth={2} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edytuj"
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <Pencil className="h-5 w-5 text-foreground" strokeWidth={2} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Usuń"
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <Trash2 className="h-5 w-5 text-destructive" strokeWidth={2} />
          </button>
        )}
        <button
          onClick={onOpen}
          aria-label="Rozwiń"
          className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        >
          <ChevronUp className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </button>
      </div>

      {/* Dolny-lewy opis. right-[3.25rem]=52px + px-5(20px) -> tekst konczy sie 72px od
          prawej = 12px odstepu od guzikow (right-3=12 + w-12=48 -> lewa krawedz 60px). */}
      <div className="absolute left-0 right-[3.25rem] bottom-6 z-10 px-5 pointer-events-none">
        {/* Meta: nachodzacy stack awatarow (host + uczestnicy) + jedna linia tekstu bez lamania. */}
        <div className="flex items-center gap-2 text-white text-[13px] font-semibold mb-1.5 min-w-0 [text-shadow:_0_1px_3px_rgb(0_0_0_/_45%)]">
          {(authorName || participants.length > 0) && (
            <span className="flex items-center -space-x-2 shrink-0">
              {authorName && (
                <img src={avatarSrc(authorAvatar ?? null)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 ring-2 ring-black/25" />
              )}
              {participants.slice(0, 3).map((a, i) => (
                <img key={i} src={avatarSrc(a ?? null)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 ring-2 ring-black/25" />
              ))}
              {participants.length > 3 && (
                <span className="h-6 w-6 rounded-full bg-black/60 ring-2 ring-black/25 flex items-center justify-center text-[9px] font-bold">+{participants.length - 3}</span>
              )}
            </span>
          )}
          <span className="flex items-center gap-1.5 min-w-0 whitespace-nowrap">
            {authorName && <span className="truncate max-w-[7.5rem]">{authorName}</span>}
            {city && (<><span className="opacity-50 shrink-0">·</span><span className="truncate">{city}</span></>)}
            {countLabel && (<><span className="opacity-50 shrink-0">·</span><span className="shrink-0">{countLabel}</span></>)}
          </span>
        </div>
        <p className="text-white text-2xl font-black leading-tight line-clamp-2 [text-shadow:_0_2px_6px_rgb(0_0_0_/_45%)]">{title}</p>
        {description && (
          <p className="text-white/85 text-sm leading-snug mt-1.5 line-clamp-2 [text-shadow:_0_1px_3px_rgb(0_0_0_/_45%)]">{description}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white/80 capitalize">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
