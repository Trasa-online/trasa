import { Bookmark, Heart, Eye, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc } from "@/lib/avatar";
import { PlaceTile } from "@/components/profile/PlaceTile";

export interface FeedCounts {
  saves: number;
  likes: number;
  views: number;
}

// Karta feedu profilu (redesign 07): avatar + eyebrow + timestamp + tytul, siatka 3-kol
// kafelkow miejsc, stopka z metrykami (statystyki wg decyzji: zapisania + polubienia +
// wyswietlenia). Uzywana dla LIST i WYJAZDOW - rozni je tylko eyebrow/tytul/dane.
// onEdit/onDelete: opcjonalne akcje wlasciciela (olowek + kosz w stopce). Podawane TYLKO na
// wlasnym profilu; na cudzym (PublicProfile) pomijane -> ikony sie nie renderuja.
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
}: {
  avatarUrl?: string | null;
  fallback?: string;
  eyebrow: string;
  timestamp?: string;
  title: string;
  tiles: any[];
  counts: FeedCounts;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
            <div className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                {eyebrow}
              </p>
              {timestamp && <span className="shrink-0 text-[11px] text-muted-foreground">{timestamp}</span>}
            </div>
            <p className="text-lg font-bold leading-tight line-clamp-1 text-foreground">{title}</p>
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

      {/* Stopka: zapisania / polubienia / wyswietlenia + (wlasciciel) edycja / usuniecie */}
      <div className="flex items-center gap-5 pt-3 mt-3 border-t border-border/40 text-muted-foreground">
        <span className="flex items-center gap-1.5 text-sm tabular-nums">
          <Bookmark className="h-[18px] w-[18px]" /> {counts.saves}
        </span>
        <span className="flex items-center gap-1.5 text-sm tabular-nums">
          <Heart className="h-[18px] w-[18px]" /> {counts.likes}
        </span>
        <span className="flex items-center gap-1.5 text-sm tabular-nums">
          <Eye className="h-[18px] w-[18px]" /> {counts.views}
        </span>
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
