import { Cloud, Heart } from "lucide-react";
import { BrandIcon, STAR_ICON } from "@/components/BrandIcon";
import { DEFAULT_FRAME_COLOR, isFrameColor, type AvatarFrameId } from "@/lib/avatarFrames";

// Ramka awatara (prosba Nat 2026-09-11): cztery znaczki krazace wokol zdjecia w petli - gwiazdki
// (brandowy SVG), serduszka albo chmurki w tym samym stylu. Znaczki LEZA na awatarze: srodek
// orbity to ~krawedz zdjecia, wiec kazdy znaczek w polowie nachodzi na fotke (druga iteracja -
// pierwsza krazyla na zewnatrz i wygladala jak osobny pierscien).
//
// Nakladka, nie opakowanie: pointer-events-none, bez wplywu na uklad - wystarczy polozyc ja
// obok <Avatar> w elemencie `relative`. `size` = srednica awatara w px.
//
// Ruch: pierscien obraca sie 14 s na obrot, kazdy znaczek kontr-rotuje z ta sama predkoscia,
// wiec stoi prosto i tylko wedruje po okregu. `motion-reduce` zatrzymuje ruch (znaczki
// zostaja jako statyczna ozdoba).
//
// Kolor: JEDEN dla calej nakladki, z profiles.avatar_frame_color; brak = pomarancz marki
// (decyzja Nat 2026-09-11: domyslnie wszystkie nakladki pomaranczowe, user moze wybrac
// dowolny). Chmurka dostaje cienki bialy obrys, zeby ksztalt czytal sie takze na zdjeciu.
const SPIN_S = 14;

function Glyph({ kind, px }: { kind: AvatarFrameId; px: number }) {
  if (kind === "stars") return <BrandIcon src={STAR_ICON} className="h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" />;
  if (kind === "hearts") return <Heart className="h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" fill="currentColor" strokeWidth={1.5} style={{ width: px, height: px }} />;
  return <Cloud className="h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" fill="currentColor" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} style={{ width: px, height: px }} />;
}

export default function AvatarFrame({ kind, color, size, className = "" }: { kind: AvatarFrameId | null | undefined; color?: string | null; size: number; className?: string }) {
  if (!kind) return null;
  const tint = isFrameColor(color) ? color : DEFAULT_FRAME_COLOR;
  const ring = Math.round(size * 0.94);            // srednica orbity: srodki znaczkow tuz przy krawedzi
  const glyph = Math.max(9, Math.round(size * 0.24));   // 76 px -> 18 px, 24 px (naglowek) -> 9 px
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ width: ring, height: ring, color: tint }}
    >
      <span className="absolute inset-0 motion-reduce:[animation:none]" style={{ animation: `spontaway-orbit ${SPIN_S}s linear infinite` }}>
        {[0, 90, 180, 270].map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2"
            style={{ width: glyph, height: glyph, transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(${-ring / 2}px)` }}
          >
            {/* Animacja nadpisuje statyczny transform, wiec kompensacja kata pozycji (-deg)
                siedzi o poziom nizej - inaczej kazdy znaczek stalby przekrecony o swoj kat. */}
            <span className="block h-full w-full motion-reduce:[animation:none]" style={{ animation: `spontaway-orbit-counter ${SPIN_S}s linear infinite` }}>
              <span className="block h-full w-full" style={{ transform: `rotate(${-deg}deg)` }}>
                <Glyph kind={kind} px={glyph} />
              </span>
            </span>
          </span>
        ))}
      </span>
      <style>{`
        @keyframes spontaway-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spontaway-orbit-counter { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
    </span>
  );
}
