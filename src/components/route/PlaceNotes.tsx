import { avatarSrc } from "@/lib/avatar";
import type { PlaceNote } from "@/lib/placeNotes";
import { localizeTag } from "@/lib/routeTags";

// Notki uczestnikow pod miejscem (redesign 2026-08-27, Figma "perspektywa innego usera"): kazda notka
// = szary dymek z tekstem + awatar autora w PRAWYM-DOLNYM rogu (bez nazwy - awatar wystarcza).
// Multi-user - kazdy uczestnik widzi notki wszystkich. Uzywany w W Trakcie (ActiveTripPlanEditor),
// widoku trasy (SharedRoute/ReviewSummary) i eksploracji. excludeUserId = pomija notke danej osoby
// (np. w edytorze wlasna notka jest juz w textarea, wiec pokazujemy tylko cudze).
export default function PlaceNotes({ notes, excludeUserId, className }: {
  notes: PlaceNote[];
  excludeUserId?: string | null;
  className?: string;
}) {
  const shown = excludeUserId ? notes.filter((n) => n.user_id !== excludeUserId) : notes;
  if (!shown.length) return null;
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {shown.map((n) => (
        <div key={`${n.user_id}-${n.place_name}`} className="relative bg-muted/50 rounded-2xl px-3.5 py-2.5">
          {/* Werdykt autora ("Musisz odwiedzić!" itd.) - kazdy uczestnik ma swoj, wiec stoi przy
              JEGO notce, a nie przy miejscu. Sam werdykt, bez notki, tez jest wypowiedzia. */}
          {n.verdict && (
            <span className="inline-flex items-center rounded-full bg-[#FDF184] border border-[#FDCD84] px-2.5 py-1 text-[12px] font-semibold text-foreground mb-1.5">
              {localizeTag(n.verdict)}
            </span>
          )}
          {n.note && <p className="text-[13.5px] text-foreground/85 leading-snug whitespace-pre-wrap break-words">{n.note}</p>}
          {/* Awatar autora w prawym-dolnym rogu dymka (biala obwodka = odklejony od tla). */}
          <img
            src={avatarSrc(n.avatar_url)}
            alt={n.username ?? ""}
            title={n.username ?? undefined}
            className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full object-cover border-2 border-white shadow-sm bg-secondary"
          />
        </div>
      ))}
    </div>
  );
}
