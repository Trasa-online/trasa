import { Bookmark, Heart, Pencil, Trash2, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc } from "@/lib/avatar";
import { PlaceTile } from "@/components/profile/PlaceTile";

export interface FeedCounts {
  saves: number;
  likes: number;
  views: number;
}

// Karta feedu profilu (redesign 07/08, IA 2026-08-20): avatar + (opcjonalny eyebrow) + timestamp
// + tytul, siatka 3-kol kafelkow miejsc, stopka.
// - eyebrow: WYJAZDY pokazuja (kraj·miasto·data); LISTY nie (eyebrow="" -> ukryty, tytul u gory).
// - isPrivate: prywatna lista "do zobaczenia" -> stopka = kłódka + "Prywatne" (bez metryk, bo
//   prywatna = nikt jej nie widzi); publiczna/wyjazd -> metryki (zapisania + polubienia).
// - onEdit/onDelete: akcje wlasciciela (olowek + kosz). TYLKO na wlasnym profilu; na cudzym
//   (PublicProfile) i w zakładce Zapisane (cudza tresc) pomijane.
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
}) {
  const shown = (tiles ?? []).slice(0, 6);
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
          </div>
        )}
      </button>

      {/* Stopka: prywatna -> kłódka; publiczna/wyjazd -> metryki. + (wlasciciel) edycja/usuniecie */}
      <div className="flex items-center gap-5 pt-3 mt-3 border-t border-border/40 text-muted-foreground">
        {isPrivate ? (
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
        )}
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
    </div>
  );
}
