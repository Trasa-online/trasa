import { avatarSrc } from "@/lib/avatar";
import type { PlaceNote } from "@/lib/placeNotes";

// Blok notek uczestnikow pod miejscem: awatar + imie/username + tresc. Multi-user - kazdy uczestnik
// widzi notki wszystkich. Uzywany w W Trakcie (ActiveTripPlanEditor), widoku trasy (ReviewSummary
// read) i eksploracji (SharedRoute). excludeUserId = pomija notke danej osoby (np. w edytorze wlasna
// notka jest juz w textarea, wiec pokazujemy tylko cudze).
export default function PlaceNotes({ notes, excludeUserId, className }: {
  notes: PlaceNote[];
  excludeUserId?: string | null;
  className?: string;
}) {
  const shown = excludeUserId ? notes.filter((n) => n.user_id !== excludeUserId) : notes;
  if (!shown.length) return null;
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {shown.map((n) => (
        <div key={`${n.user_id}-${n.place_name}`} className="flex items-start gap-2">
          <img src={avatarSrc(n.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-secondary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground/75 leading-tight">{n.username || "Uczestnik"}</p>
            <p className="text-[13px] text-foreground/90 leading-snug whitespace-pre-wrap break-words">{n.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
