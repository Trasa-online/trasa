import { avatarSrc } from "@/lib/avatar";
import type { PlaceNote } from "@/lib/placeNotes";
import TranslatableText from "@/components/TranslatableText";

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
  // Werdykty ("Musisz odwiedzic!" itd.) zniknely z apki 2026-09-13 - jedynym wyroznieniem jest
  // gwiazdka przy miejscu, wiec wiersz bez tresci notki nie ma tu czego pokazac.
  const shown = notes.filter((n) => (excludeUserId ? n.user_id !== excludeUserId : true) && n.note && n.note.trim());
  if (!shown.length) return null;
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {shown.map((n) => {
        const avatar = (
          <img
            src={avatarSrc(n.avatar_url)}
            alt={n.username ?? ""}
            title={n.username ?? undefined}
            className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full object-cover border-2 border-white shadow-sm bg-secondary"
          />
        );
        return (
          <div key={`${n.user_id}-${n.place_name}`} className="relative bg-muted/50 rounded-2xl px-3.5 py-2.5">
            {/* Cudza notka w innym jezyku dostaje guzik "Przetlumacz" (TranslatableText). */}
            {n.note && <TranslatableText text={n.note} className="text-[13.5px] text-foreground/85 leading-snug whitespace-pre-wrap break-words" buttonClassName="pr-6" />}
            {/* Awatar autora w prawym-dolnym rogu dymka (biala obwodka = odklejony od tla). */}
            {avatar}
          </div>
        );
      })}
    </div>
  );
}
