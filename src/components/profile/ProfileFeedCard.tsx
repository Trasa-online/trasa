import { useState } from "react";
import { Bookmark, Heart, Pencil, Trash2, Lock, CircleDashed, Maximize2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc } from "@/lib/avatar";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { buildTripStaticMapUrl } from "@/lib/staticMap";
import RouteMap from "@/components/RouteMap";

export interface FeedCounts {
  saves: number;
  /** Bez tego pola serce w ogole sie nie renderuje - listy miejsc nie maja polubien. */
  likes?: number;
  views?: number;
}

// Karta feedu profilu (redesign 07/08, IA 2026-08-20): avatar + (opcjonalny eyebrow) + timestamp
// + tytul, siatka 3-kol kafelkow miejsc, opcjonalna mapka, stopka.
// - eyebrow: WYJAZDY pokazuja (kraj·miasto·data); LISTY nie (eyebrow="" -> ukryty, tytul u gory).
// - isPrivate: prywatna lista "do zobaczenia" -> stopka = kłódka + "Prywatne" (bez metryk).
// - isDraft: roboczy (nieopublikowany) wyjazd -> stopka = "Robocze" (ikona + label, na wysokosci
//   ikon edycji/usuwania), bez metryk. Zastepuje eyebrow "Robocze" (przeniesione do stopki).
// - mapPins: piny z lat/lng -> statyczna mapka pod kafelkami, tap = pelny ekran (interaktywna).
// - onEdit/onDelete: akcje wlasciciela (olowek + kosz). TYLKO na wlasnym profilu.
export function ProfileFeedCard({
  avatarUrl,
  fallback,
  eyebrow,
  timestamp,
  title,
  tiles,
  counts,
  onOpen,
  onEdit,
  onDelete,
  isPrivate,
  hideStats,
  mapPins,
  isDraft,
  onLike,
  liked,
  onSave,
  saved,
  description,
  tags,
  badge,
}: {
  avatarUrl?: string | null;
  fallback?: string;
  eyebrow?: string;
  timestamp?: string;
  title: string;
  description?: string | null; // opis wyjazdu (review_narrative/ai_summary) - pod nazwa
  // Tagi (routes.tags / discovery_collections.tags) - pigulki pod opisem. Na WLASNYM profilu
  // ich nie przekazujemy (decyzja Nat 2026-08-28: na karcie zostaje sam opis); zostaja na
  // profilu publicznym, gdzie pomagaja rozpoznac czym jest cudza lista/wyjazd.
  tags?: string[];
  tiles: any[];
  counts: FeedCounts;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isPrivate?: boolean;
  hideStats?: boolean; // ukryj metryki zapisow/polubien (bez wskaznika)
  mapPins?: any[]; // piny z lat/lng -> mapka podgladowa pod kafelkami (tylko wyjazdy)
  isDraft?: boolean; // roboczy wyjazd - stopka pokazuje wskaznik "Robocze" (zamiast metryk)
  // Interaktywne polubienie/zapis z karty (cudzy profil). Gdy podane -> ikona = przycisk (stan
  // liked/saved); bez nich -> statyczny licznik (wlasny profil). Wybor Nat 2026-08-23.
  onLike?: () => void;
  liked?: boolean;
  onSave?: () => void;
  saved?: boolean;
  badge?: React.ReactNode; // chip przy tytule (np. "Nowe miejsce!" na zapisanej liscie)
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const mapUrl = mapPins && mapPins.length ? buildTripStaticMapUrl(mapPins) : null;
  // Siatka max 6 kafli. Gdy wiecej: 5 kafli + ostatni "przygaszony +N" (reszta miejsc).
  const tilesArr = tiles ?? [];
  const MAX_TILES = 3;   // jeden rzad pionowych kafelkow (2:3) - redesign 2026-08-25
  const hasOverflow = tilesArr.length > MAX_TILES;
  const shown = hasOverflow ? tilesArr.slice(0, MAX_TILES - 1) : tilesArr.slice(0, MAX_TILES);
  const overflowCount = hasOverflow ? tilesArr.length - (MAX_TILES - 1) : 0;
  return (
    // Wrapper NIE jest <button> - stopka zawiera wlasne guziki (olowek/kosz), a button w
    // buttonie to nieprawidlowy HTML. Klikalny jest tylko obszar naglowek+kafelki.
    <div className="w-full">
      <button onClick={onOpen} className="w-full text-left block active:opacity-95 transition-opacity">
        {/* Naglowek: avatar + (eyebrow + czas) + tytul */}
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={avatarSrc(avatarUrl)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">
              {(fallback || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            {eyebrow ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                    {eyebrow}
                  </p>
                  {timestamp && <span className="shrink-0 text-[11px] text-muted-foreground">{timestamp}</span>}
                </div>
                <p className="text-lg font-bold leading-tight line-clamp-1 text-foreground">{title}</p>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-lg font-bold leading-tight line-clamp-1 text-foreground">{title}</p>
                {timestamp && <span className="shrink-0 pt-1 text-[11px] text-muted-foreground">{timestamp}</span>}
              </div>
            )}
            {badge && <div className="mt-1.5">{badge}</div>}
          </div>
        </div>

        {/* Opis + tagi pod nazwa wyjazdu (prosba Nat 2026-08-26). */}
        {(description || (tags && tags.length > 0)) && (
          <div className="mt-2">
            {description && <p className="text-[13.5px] text-muted-foreground leading-snug line-clamp-2">{description}</p>}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {tags.slice(0, 6).map((tg) => (
                  <span key={tg} className="inline-flex items-center rounded-full bg-secondary text-foreground px-2.5 py-0.5 text-[11.5px] font-semibold">{tg}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Siatka kafelkow miejsc (max 6) */}
        {shown.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {/* Bez obwodki na "nowych" kafelkach (decyzja Nat 2026-09-01) - o nowosci mowi sam
                dymek nad siatka, a podwojne zaznaczenie robilo z karty choinke. */}
            {shown.map((t, i) => (
              <PlaceTile key={t.id ?? i} tile={t} />
            ))}
            {overflowCount > 0 && (
              /* Kafelek "ile jeszcze" - zolty #FDF184 z pomaranczowa liczba w Sigmarze (prosba Nat
                 2026-09-01). Zolty to jedyny akcent poza pomaranczem, wiec licznik czyta sie od razu
                 jako "jest tu tego wiecej", a nie jako kolejne szare zdjecie. */
              <div className="aspect-[2/3] rounded-2xl bg-[#FDF184] flex items-center justify-center">
                <span className="text-2xl text-[#F75708]" style={{ fontFamily: "Sigmar, system-ui, sans-serif" }}>+{overflowCount}</span>
              </div>
            )}
          </div>
        )}
      </button>

      {/* Mapka podgladowa (tylko wyjazdy ze wspolrzednymi) - tap = pelny ekran */}
      {mapUrl && (
        <button
          onClick={() => setMapOpen(true)}
          aria-label="Pokaż mapę wyjazdu"
          className="relative mt-3 w-full aspect-[16/9] rounded-2xl overflow-hidden bg-muted active:opacity-95 transition-opacity"
        >
          <img src={mapUrl} alt="Mapa wyjazdu" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
            <Maximize2 className="h-4 w-4 text-foreground" />
          </span>
        </button>
      )}

      {/* Stopka: roboczy -> "Robocze"; prywatna -> kłódka; publiczna -> metryki. + (wlasciciel) edycja/usuniecie */}
      <div className="flex items-center gap-5 pt-3 mt-3 border-t border-border/40 text-muted-foreground">
        {isDraft ? (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <CircleDashed className="h-[16px] w-[16px]" /> Robocze
          </span>
        ) : !hideStats && (isPrivate ? (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Lock className="h-[16px] w-[16px]" /> Prywatne
          </span>
        ) : (
          <>
            {onSave ? (
              <button onClick={onSave} aria-label={saved ? "Usuń z zapisanych" : "Zapisz"} className="flex items-center gap-1.5 text-sm tabular-nums active:scale-90 transition-transform">
                <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-orange-600 text-orange-600" : ""}`} /> {counts.saves}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm tabular-nums">
                <Bookmark className="h-[18px] w-[18px]" /> {counts.saves}
              </span>
            )}
            {/* Serce pokazujemy TYLKO gdy licznik polubien w ogole podano. Listy miejsc go nie maja
                (decyzja Nat 2026-09-01) - u nich zostaje sam zapis. */}
            {counts.likes !== undefined && (onLike ? (
              <button onClick={onLike} aria-label={liked ? "Cofnij polubienie" : "Polub"} className="flex items-center gap-1.5 text-sm tabular-nums active:scale-90 transition-transform">
                <Heart className={`h-[18px] w-[18px] ${liked ? "fill-red-500 text-red-500" : ""}`} /> {counts.likes}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm tabular-nums">
                <Heart className="h-[18px] w-[18px]" /> {counts.likes}
              </span>
            ))}
          </>
        ))}
        {(onEdit || onDelete) && (
          <>
            <div className="flex-1" />
            {onEdit && (
              <button onClick={onEdit} aria-label="Edytuj" className="h-8 w-8 flex items-center justify-center rounded-full active:bg-muted/60 transition-colors">
                <Pencil className="h-[17px] w-[17px]" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} aria-label="Usuń" className="h-8 w-8 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 transition-colors">
                <Trash2 className="h-[17px] w-[17px]" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Pelny ekran mapy (interaktywna) */}
      {mapOpen && mapPins && mapPins.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 shrink-0 border-b border-border/40">
            <p className="text-base font-bold truncate">{title}</p>
            <button onClick={() => setMapOpen(false)} aria-label="Zamknij mapę" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <RouteMap pins={mapPins} className="h-full w-full" showRoute />
          </div>
        </div>
      )}
    </div>
  );
}
