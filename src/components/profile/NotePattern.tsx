import { PatternGlyph } from "@/components/profile/AvatarFrame";
import { useAvatarFrame } from "@/lib/avatarFrameLoader";
import { isAvatarFrame, type AvatarFrameId } from "@/lib/avatarFrames";

// WZOR NAKLADKI W TLE NOTKI (prosba Nat 2026-09-26): notka osoby z nakladka awatara (serduszka,
// chmurki, ksiezyce...) dostaje w tle dymka te same znaczki - w jasnej szarosci i przy niskim
// kryciu, zeby tekst zostal w pelni czytelny. 2026-09-26 (druga iteracja, Nat): krycie 10 %
// i znaczki ~3x wieksze, za to rzadsze - drobny gesty wzor czytal sie jak szum pod tekstem. Dotyczy notek przy miejscach w PLANACH
// i KOLEKCJACH (PlaceNotes + wlasna notka w PlaceNoteEditor).
//
// Szary, NIE kolor nakladki: kolorowe znaczki pod tekstem czytalyby sie jak ozdobny papier,
// a przy pomaranczu marki walczylyby z trescia. Tecza nie ma znaczka - brak wzoru.
//
// Warstwa `absolute inset-0` z `overflow-hidden` i `rounded-[inherit]`, wiec rodzic (dymek)
// musi byc `relative` i miec wlasne zaokraglenie; tresc dymka stoi nad nia (`relative`).

// Zapas na najdluzsza notke i najszerszy dymek - nadmiar ucina `overflow-hidden`.
const ROWS = 6;
const PER_ROW = 7;

export default function NotePattern({ userId, frame }: { userId?: string | null; frame?: string | null }) {
  // `frame` podany wprost wygrywa (np. wlasna notka, gdzie ramke juz znamy).
  const loaded = useAvatarFrame(frame === undefined ? userId : null);
  const kind = frame !== undefined ? frame : loaded?.frame;
  if (!isAvatarFrame(kind) || kind === "rainbow") return null;
  const k = kind as Exclude<AvatarFrameId, "rainbow">;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" style={{ color: "#5E5E5E", opacity: 0.1 }}>
      {Array.from({ length: ROWS }, (_, r) => (
        // Rzedy przesuniete naprzemiennie o pol kroku - wzor czyta sie jak tapeta, nie jak siatka.
        <div key={r} className="flex" style={{ gap: 26, marginTop: r === 0 ? -6 : 10, marginLeft: r % 2 ? -20 : 8 }}>
          {Array.from({ length: PER_ROW }, (_, c) => (
            <span key={c} className="shrink-0" style={{ transform: `rotate(${((r * 3 + c * 5) % 7 - 3) * 8}deg)` }}>
              <PatternGlyph kind={k} px={(r + c) % 3 === 0 ? 36 : 28} i={r + c} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
