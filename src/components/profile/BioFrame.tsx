import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// RAMKA WOKOL OPISU PROFILU (prosba Nat 2026-09-25): kwiatki, laka, smuga. Na razie czysto
// wizualne, bez animacji. 2026-09-26: trawa, zawijasy i serduszka ZDJETE (decyzja Nat), doszedl
// KOLOR ramki (`profiles.bio_frame_color`, NULL = kolory marki).
//
// Opis stoi w WASKIEJ kolumnie obok imienia (3 linie, 13 px), wiec ozdoby sa drobne i trzymaja
// sie narozy i krawedzi pudelka - nie moga wchodzic na imie ani na rzad statystyk. Pudelko ma
// staly padding, a ozdoby leza absolutnie w jego marginesie.
//
// Domyslnie kolory marki. Kolor usera przejmuje smuga (cala) i PLATKI kwiatow; zielen trawy
// i lodyg zostaje zielona - trawa w kolorze usera czytalaby sie jak grzebien, nie jak trawa.
//
// ⛔ Nowy wariant = CZTERY miejsca: `BIO_FRAMES`, rysunek w `Decoration`, CHECK
// `profiles_bio_frame_check` w bazie (migracje 20260926, 20260926b) i etykieta
// `bio_frames.<id>` w settings.json PL i EN. Bez CHECK zapis wywali sie bledem 23514.

export const BIO_FRAMES = ["streak", "meadow", "flowers"] as const;
export type BioFrameKind = typeof BIO_FRAMES[number];
export const isBioFrame = (v: unknown): v is BioFrameKind => typeof v === "string" && (BIO_FRAMES as readonly string[]).includes(v);
export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

/** Szybkie kolory ramki opisu (obok pipety). Jasne, bo to tlo/ozdoba przy szarym tekscie. */
export const BIO_FRAME_SWATCHES = ["#FDF184", "#FDCD84", "#F4A259", "#EE5307", "#F9B4C8", "#A7D8F0", "#B9E4A8", "#C9B6F2"];

// Kolor usera -> odcienie. `mix` zbliza kolor do bieli (drugi kwiatek, ciemny kolor smugi).
function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(hex: string, t: number) {
  const [r, g, b] = rgb(hex);
  const m = (c: number) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type Palette = { streak: string; petal: string; petal2: string; petal3: string; center: string };
const BRAND_PALETTE: Palette = { streak: "#FDF184", petal: "#F4A259", petal2: "#FDCD84", petal3: "#EE5307", center: "#FDF184" };
function paletteFor(color: string | null | undefined): Palette {
  if (!isHexColor(color)) return BRAND_PALETTE;
  const lum = luminance(color);
  return {
    // Szary tekst opisu musi sie dac przeczytac - ciemny kolor smugi rozjasniamy.
    streak: lum < 0.45 ? mix(color, 0.62) : color,
    petal: color,
    petal2: mix(color, 0.45),
    petal3: mix(color, 0.2),
    // Srodek kwiatka odcina sie od platkow: przy jasnych platkach braz, przy ciemnych zolty.
    center: lum > 0.6 ? "#5B2C06" : "#FDF184",
  };
}

const GREEN = "#6FA24A";
const GREEN_DARK = "#4F8434";

function Flower({ x, y, r, petal, center }: { x: number; y: number; r: number; petal: string; center: string }) {
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const rad = (a * Math.PI) / 180;
    return <circle key={a} cx={x + Math.cos(rad) * r} cy={y + Math.sin(rad) * r} r={r * 0.78} fill={petal} />;
  });
  return <g>{petals}<circle cx={x} cy={y} r={r * 0.62} fill={center} /></g>;
}


// Pas trawy przy dolnej krawedzi: stala wysokosc, rozciagana WYLACZNIE szerokosc
// (`preserveAspectRatio="none"`), wiec zdzbla robia sie tylko rzadsze albo gestsze.
function GrassStrip() {
  const blades: ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 2 + i * 4.6;
    const h = 5 + ((i * 7) % 5);
    const lean = ((i * 3) % 5) - 2;
    blades.push(
      <path key={i} d={`M${x - 1.3} 14 Q${x + lean * 0.5} ${14 - h * 0.6} ${x + lean} ${14 - h} Q${x + lean * 0.3} ${14 - h * 0.45} ${x + 1.3} 14Z`}
        fill={i % 3 === 0 ? GREEN_DARK : GREEN} />,
    );
  }
  return (
    <svg viewBox="0 0 122 14" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-1 h-3.5 w-full" aria-hidden>
      {blades}
    </svg>
  );
}

function Decoration({ kind, pal }: { kind: BioFrameKind; pal: Palette }) {
  switch (kind) {
    case "flowers":
      return (
        <>
          <svg viewBox="0 0 26 22" className="absolute -left-2.5 -top-3 h-[28px] w-[33px]" aria-hidden>
            <path d="M9 11c4 2 8 1 11-3" stroke={GREEN} strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <ellipse cx={19} cy={9} rx={3.4} ry={1.6} transform="rotate(-35 19 9)" fill={GREEN} />
            <Flower x={8} y={8} r={3.4} petal={pal.petal} center={pal.center} />
          </svg>
          <svg viewBox="0 0 22 20" className="absolute -bottom-3 -right-2.5 h-[26px] w-[29px]" aria-hidden>
            <Flower x={13} y={11} r={3} petal={pal.petal2} center={pal.center} />
            <Flower x={5} y={14} r={2} petal={pal.petal3} center={pal.center} />
          </svg>
        </>
      );
    case "meadow":
      return (
        <>
          <GrassStrip />
          <svg viewBox="0 0 122 22" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 -bottom-1 h-[22px] w-full" aria-hidden>
            {[{ x: 14, h: 12, p: pal.petal }, { x: 58, h: 16, p: pal.petal2 }, { x: 101, h: 10, p: pal.petal3 }].map((f) => (
              <g key={f.x}>
                <path d={`M${f.x} 22V${22 - f.h}`} stroke={GREEN_DARK} strokeWidth={1} />
                <Flower x={f.x} y={22 - f.h} r={2.2} petal={f.p} center={pal.center} />
              </g>
            ))}
          </svg>
        </>
      );
    case "streak":
      // Zakreslacz pod CALYM opisem (nie pod jedna linia) - nierowne krawedzie jak pociagniecie
      // markerem.
      return (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute -inset-x-1 -inset-y-0.5 h-[calc(100%+4px)] w-[calc(100%+8px)]" aria-hidden>
          <path d="M4 5C20 1 70 2.5 94 4.5c4.6.6 4.4 7 1.8 11.4 3 4.8 3 11.8-.4 15.6C82 37 26 37.6 6 35.6 1.4 34.6 1 28 3.6 23 .8 18 .8 9.6 4 5Z" fill={pal.streak} />
        </svg>
      );
  }
}

/** Opis profilu w ramce. Bez `kind` = sam tekst, bez zadnego paddingu (wyglad sprzed ramek). */
export default function BioFrame({ kind, color, children, className }: { kind: BioFrameKind | null | undefined; color?: string | null; children: ReactNode; className?: string }) {
  if (!kind) return <>{children}</>;
  return (
    <div className={cn("relative", kind === "streak" ? "px-2.5 py-2" : "px-3 py-2", kind === "meadow" && "pb-4", className)}>
      <Decoration kind={kind} pal={paletteFor(color)} />
      <div className="relative">{children}</div>
    </div>
  );
}
