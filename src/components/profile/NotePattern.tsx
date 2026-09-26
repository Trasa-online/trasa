import { PatternGlyph } from "@/components/profile/AvatarFrame";
import { useAvatarFrame } from "@/lib/avatarFrameLoader";
import { isAvatarFrame, type AvatarFrameId } from "@/lib/avatarFrames";

// WZOR NAKLADKI W TLE NOTKI (prosba Nat 2026-09-26): notka osoby z nakladka awatara (serduszka,
// chmurki, ksiezyce...) dostaje w tle dymka te same znaczki - w jasnej szarosci i przy niskim
// kryciu, zeby tekst zostal w pelni czytelny. Dotyczy notek przy miejscach w PLANACH
// i KOLEKCJACH (PlaceNotes + wlasna notka w PlaceNoteEditor).
//
// Szary, NIE kolor nakladki: kolorowe znaczki pod tekstem czytalyby sie jak ozdobny papier,
// a przy pomaranczu marki walczylyby z trescia. Tecza nie ma znaczka - brak wzoru.
//
// Warstwa `absolute inset-0` z `overflow-hidden` i `rounded-[inherit]`, wiec rodzic (dymek)
// musi byc `relative` i miec wlasne zaokraglenie; tresc dymka stoi nad nia (`relative`).

// Zapas na najdluzsza notke i najszerszy dymek - nadmiar ucina `overflow-hidden`.
const ROWS = 14;
const PER_ROW = 14;

export default function NotePattern({ userId, frame }: { userId?: string | null; frame?: string | null }) {
  // `frame` podany wprost wygrywa (np. wlasna notka, gdzie ramke juz znamy).
  const loaded = useAvatarFrame(frame === undefined ? userId : null);
  const kind = frame !== undefined ? frame : loaded?.frame;
  if (!isAvatarFrame(kind) || kind === "rainbow") return null;
  const k = kind as Exclude<AvatarFrameId, "rainbow">;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" style={{ color: "#8C8C8C", opacity: 0.3 }}>
      {Array.from({ length: ROWS }, (_, r) => (
        // Rzedy przesuniete naprzemiennie o pol kroku - wzor czyta sie jak tapeta, nie jak siatka.
        <div key={r} className="flex" style={{ gap: 16, marginTop: r === 0 ? 4 : 8, marginLeft: r % 2 ? -4 : 10 }}>
          {Array.from({ length: PER_ROW }, (_, c) => (
            <span key={c} className="shrink-0" style={{ transform: `rotate(${((r * 3 + c * 5) % 7 - 3) * 8}deg)` }}>
              <PatternGlyph kind={k} px={(r + c) % 3 === 0 ? 13 : 10} i={r + c} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
