import { useState } from "react";
import { Bookmark, Heart, Pencil, Trash2, Lock, CircleDashed, Maximize2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc } from "@/lib/avatar";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { buildTripStaticMapUrl } from "@/lib/staticMap";
import RouteMap from "@/components/RouteMap";

export interface FeedCounts {
  saves: number;
  likes: number;
  views: number;
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
}: {
  avatarUrl?: string | null;
  fallback?: string;
  eyebrow?: string;
  timestamp?: string;
  title: string;
  tiles: any[];
  counts: FeedCounts;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isPrivate?: boolean;
  hideStats?: boolean; // ukryj metryki zapisow/polubien (bez wskaznika)
  mapPins?: any[]; // piny z lat/lng -> mapka podgladowa pod kafelkami (tylko wyjazdy)
  isDraft?: boolean; // roboczy wyjazd - stopka pokazuje wskaznik "Robocze" (zamiast metryk)
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const mapUrl = mapPins && mapPins.length ? buildTripStaticMapUrl(mapPins) : null;
  // Siatka max 6 kafli. Gdy wiecej: 5 kafli + ostatni "przygaszony +N" (reszta miejsc).
  const tilesArr = tiles ?? [];
  const MAX_TILES = 6;
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
          </div>
        </div>

        {/* Siatka kafelkow miejsc (max 6) */}
        {shown.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {shown.map((t, i) => (
              <PlaceTile key={t.id ?? i} tile={t} />
            ))}
            {overflowCount > 0 && (
              <div className="aspect-square rounded-2xl bg-muted flex items-center justify-center">
                <span className="text-lg font-bold text-muted-foreground">+{overflowCount}</span>
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
            <span className="flex items-center gap-1.5 text-sm tabular-nums">
              <Bookmark className="h-[18px] w-[18px]" /> {counts.saves}
            </span>
            <span className="flex items-center gap-1.5 text-sm tabular-nums">
              <Heart className="h-[18px] w-[18px]" /> {counts.likes}
            </span>
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
