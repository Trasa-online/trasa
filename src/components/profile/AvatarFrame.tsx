import { Cloud, Heart, Moon } from "lucide-react";
import { DEFAULT_FRAME_COLOR, isFrameColor, type AvatarFrameId } from "@/lib/avatarFrames";
import { STAR_PATH, STAR_VIEWBOX } from "@/components/BrandStar";

// Gwiazdka z brandowego zestawu jako INLINE svg (stale w BrandStar.tsx), nie CSS mask.
// W nakladce znaczek zyje wewnatrz warstwy z animowanym transformem (obrot orbity), a WebKit
// na iOS gubi tam `-webkit-mask-image` z url() - gwiazdki renderowaly sie jako plamy albo
// znikaly w arkuszu udostepniania i na kafelkach eksploracji, podczas gdy serca i chmurki
// (inline svg z lucide) byly w porzadku (zgloszenie Nat 2026-09-13).
function StarGlyph({ px }: { px: number }) {
  return (
    <svg viewBox={STAR_VIEWBOX} width={px} height={px} className="block drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" aria-hidden>
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

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

// BANAN (prosba Nat 2026-09-16) - jedyny glif z WLASNYMI kolorami zamiast `currentColor`:
// banan musi byc zolty, wiec pipeta go nie dotyczy (`fixedColor` w AVATAR_FRAMES, arkusz
// chowa wtedy wybor koloru). Ksztalt to sylwetka banana z zestawu lucide, ale rysowana
// WYPELNIENIEM - oryginalna ikona ma jeszcze druga, otwarta sciezke "skorki", ktora po
// wypelnieniu robi sie klaksa, wiec biore samo cialo.
// ⚠️ Brazowy obrys nie jest ozdoba: przy 9 px w naglowkach plaska zolta plama na jasnym
// tle nie ma zadnej krawedzi. Ta sama sztuczka, co bialy obrys chmurki nizej.
const BANANA_BODY = "M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z";
// ⚠️ Obrot i powiekszenie nie sa kosmetyka. Banan to z natury polksiezyc, wiec w pionie ma
// DOKLADNIE ten sam zarys, co nakladka "ksiezyc" - a obie stoja obok siebie na liscie i
// rozniłby je wtedy sam kolor. Polozenie go poziomo (jak lezacy owoc) daje inna os i inna
// sylwetke na pierwszy rzut oka; `1.12` wyrownuje mase optyczna, bo sciezka banana wypelnia
// swoje pole slabiej niz ksiezyc.
function BananaGlyph({ px }: { px: number }) {
  const s = Math.round(px * 1.12);
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} className="block drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
      style={{ transform: "rotate(-115deg)" }} aria-hidden>
      <path d={BANANA_BODY} fill="#FDF184" stroke="#5B2C06" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MoonGlyph({ px }: { px: number }) {
  return <Moon className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" fill="currentColor" strokeWidth={1.5} style={{ width: px, height: px }} />;
}

// `i` = ktory z czterech znaczkow na orbicie. Potrzebuje go tylko "moonstars", gdzie ksiezyc
// i gwiazdka stoja NAPRZEMIAN (0 i 180 stopni ksiezyc, 90 i 270 gwiazdka) - cztery ksiezyce
// plus cztery gwiazdki nie zmieszczilyby sie na orbicie, a para "ksiezyc, gwiazdka" czyta sie
// jak nocne niebo dopiero wtedy, gdy elementy sie przeplataja.
function Glyph({ kind, px, i }: { kind: Exclude<AvatarFrameId, "rainbow">; px: number; i: number }) {
  if (kind === "stars") return <StarGlyph px={px} />;
  if (kind === "moon") return <MoonGlyph px={px} />;
  if (kind === "moonstars") return i % 2 === 0 ? <MoonGlyph px={px} /> : <StarGlyph px={Math.round(px * 0.82)} />;
  if (kind === "banana") return <BananaGlyph px={px} />;
  if (kind === "hearts") return <Heart className="h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" fill="currentColor" strokeWidth={1.5} style={{ width: px, height: px }} />;
  return <Cloud className="h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" fill="currentColor" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} style={{ width: px, height: px }} />;
}

// Teczowy pierscien (nagroda za zaproszenia, wzor: swiecaca ramka z zalacznika Nat - ale
// KOLKO, nie kwadrat): stozkowy gradient przyciety maska do cienkiego pierscienia tuz przy
// krawedzi awatara + rozmyta kopia pod spodem jako poswiata. Obrot gradientu = kolory
// "plyna" po okregu. Kolor usera tu nie ma zastosowania - tecza jest tecza.
function RainbowRing({ size }: { size: number }) {
  const gap = Math.max(2, Math.round(size * 0.05));       // odstep pierscienia od zdjecia
  const thick = Math.max(2, Math.round(size * 0.085));    // grubosc pierscienia (76 px -> 6 px)
  const outer = size + 2 * (gap + thick);
  const gradient = "conic-gradient(from 0deg, #ff4d4d, #ffb000, #ffe600, #37e26f, #26c6ff, #6a5cff, #e04dff, #ff4d4d)";
  const ringMask = `radial-gradient(farthest-side, transparent calc(100% - ${thick + 0.5}px), #000 calc(100% - ${thick - 0.5}px))`;
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2" style={{ width: outer, height: outer }}>
      {/* Poswiata */}
      <span className="absolute inset-0 rounded-full motion-reduce:[animation:none]" style={{ background: gradient, WebkitMaskImage: ringMask, maskImage: ringMask, filter: `blur(${Math.max(3, Math.round(thick * 1.4))}px)`, opacity: 0.9, transform: "scale(1.06)", animation: "spontaway-orbit 6s linear infinite" }} />
      {/* Pierscien */}
      <span className="absolute inset-0 rounded-full motion-reduce:[animation:none]" style={{ background: gradient, WebkitMaskImage: ringMask, maskImage: ringMask, animation: "spontaway-orbit 6s linear infinite" }} />
      <style>{`@keyframes spontaway-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

export default function AvatarFrame({ kind, color, size, className = "" }: { kind: AvatarFrameId | null | undefined; color?: string | null; size: number; className?: string }) {
  if (!kind) return null;
  if (kind === "rainbow") return <RainbowRing size={size} />;
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
        {[0, 90, 180, 270].map((deg, i) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2"
            style={{ width: glyph, height: glyph, transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(${-ring / 2}px)` }}
          >
            {/* Animacja nadpisuje statyczny transform, wiec kompensacja kata pozycji (-deg)
                siedzi o poziom nizej - inaczej kazdy znaczek stalby przekrecony o swoj kat. */}
            <span className="block h-full w-full motion-reduce:[animation:none]" style={{ animation: `spontaway-orbit-counter ${SPIN_S}s linear infinite` }}>
              <span className="flex h-full w-full items-center justify-center" style={{ transform: `rotate(${-deg}deg)` }}>
                <Glyph kind={kind as Exclude<AvatarFrameId, "rainbow">} px={glyph} i={i} />
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
