import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// RAMKA WOKOL OPISU PROFILU (prosba Nat 2026-09-25): kwiatki, laka, trawa, zawijasy (wzor
// z zalacznika Nat - „Gaia's grace"), serduszka, smuga. Na razie czysto wizualne, bez animacji.
//
// Opis stoi w WASKIEJ kolumnie obok imienia (3 linie, 13 px), wiec ozdoby sa drobne i trzymaja
// sie narozy i krawedzi pudelka - nie moga wchodzic na imie ani na rzad statystyk. Pudelko ma
// staly padding, a ozdoby leza absolutnie w jego marginesie.
//
// Kolory WYLACZNIE z marki (pomarancz, zolty, zloty, braz). Jedyny wyjatek to zielen trawy
// i lodyg - trawa w kolorze marki czytalaby sie jak pomaranczowy grzebien, nie jak trawa.
//
// ⛔ Nowy wariant = CZTERY miejsca: `BIO_FRAMES`, rysunek w `Decoration`, CHECK
// `profiles_bio_frame_check` w bazie (migracja 20260926) i etykieta `bio_frames.<id>` w
// settings.json PL i EN. Bez CHECK zapis wywali sie bledem 23514.

export const BIO_FRAMES = ["flowers", "meadow", "grass", "swirls", "hearts", "streak"] as const;
export type BioFrameKind = typeof BIO_FRAMES[number];
export const isBioFrame = (v: unknown): v is BioFrameKind => typeof v === "string" && (BIO_FRAMES as readonly string[]).includes(v);

const ORANGE = "#EE5307";
const PEACH = "#F4A259";
const YELLOW = "#FDF184";
const GOLD = "#FDCD84";
const BROWN = "#5B2C06";
const GREEN = "#6FA24A";
const GREEN_DARK = "#4F8434";

function Flower({ x, y, r, petal, center }: { x: number; y: number; r: number; petal: string; center: string }) {
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const rad = (a * Math.PI) / 180;
    return <circle key={a} cx={x + Math.cos(rad) * r} cy={y + Math.sin(rad) * r} r={r * 0.78} fill={petal} />;
  });
  return <g>{petals}<circle cx={x} cy={y} r={r * 0.62} fill={center} /></g>;
}

function Heart({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 3.2C0 1.4 1.4 0 3.1 0c1.1 0 2.1.6 2.9 1.6C6.8.6 7.8 0 8.9 0 10.6 0 12 1.4 12 3.2c0 3.5-4.2 6.1-6 7.6C4.2 9.3 0 6.7 0 3.2Z"
      fill={fill}
    />
  );
}

// Ornament boczny w stylu zalacznika Nat („Gaia's grace"): cienka, falujaca linia wzdluz boku
// pudelka, zwinieta w slimacznice u gory i u dolu, z listkami i kropkami. Jeden rysunek na
// LEWY bok, prawy to odbicie. `meet` trzyma proporcje - ornament skaluje sie z wysokoscia
// opisu, ale nie rozjezdza (2-3 linie tekstu to 56-72 px).
function SwirlSide({ right }: { right?: boolean }) {
  return (
    <svg
      viewBox="0 0 18 72"
      preserveAspectRatio="xMidYMid meet"
      className={cn("absolute inset-y-0 h-full w-[18px]", right ? "-right-1" : "-left-1")}
      style={right ? { transform: "scaleX(-1)" } : undefined}
      fill="none"
      aria-hidden
    >
      <path d="M12 6.5c-1.6-2.6-5.4-2-5.6.9-.2 2.2 2.4 3 3.4 1.4M9.8 8.8C6 12 4.6 18 5.4 26c.8 7.6-.8 13.6-.8 20 0 8 1.4 13.6 5.2 16.8" stroke={BROWN} strokeOpacity={0.62} strokeWidth={1.05} strokeLinecap="round" />
      <path d="M9.8 62.8c1 1.4 3.8 1.6 4.4-.6.5-1.8-1.4-3-2.6-1.8" stroke={BROWN} strokeOpacity={0.62} strokeWidth={1.05} strokeLinecap="round" />
      <path d="M5.3 22c2.6-2.4 6-2.6 8.4-.6-2.8.2-5.4.8-8.4.6ZM4.8 48c2.4 1.8 5.6 1.8 7.8-.2-2.6-.4-5-.6-7.8.2Z" fill={PEACH} />
      <circle cx={13.6} cy={14} r={1} fill={ORANGE} />
      <circle cx={11.6} cy={35} r={0.8} fill={BROWN} fillOpacity={0.5} />
      <circle cx={13.2} cy={55.5} r={1} fill={ORANGE} />
    </svg>
  );
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

function Decoration({ kind }: { kind: BioFrameKind }) {
  switch (kind) {
    case "flowers":
      return (
        <>
          <svg viewBox="0 0 26 22" className="absolute -left-2.5 -top-3 h-[28px] w-[33px]" aria-hidden>
            <path d="M9 11c4 2 8 1 11-3" stroke={GREEN} strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <ellipse cx={19} cy={9} rx={3.4} ry={1.6} transform="rotate(-35 19 9)" fill={GREEN} />
            <Flower x={8} y={8} r={3.4} petal={PEACH} center={YELLOW} />
          </svg>
          <svg viewBox="0 0 22 20" className="absolute -bottom-3 -right-2.5 h-[26px] w-[29px]" aria-hidden>
            <Flower x={13} y={11} r={3} petal={GOLD} center={ORANGE} />
            <Flower x={5} y={14} r={2} petal={ORANGE} center={YELLOW} />
          </svg>
        </>
      );
    case "meadow":
      return (
        <>
          <GrassStrip />
          <svg viewBox="0 0 122 22" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 -bottom-1 h-[22px] w-full" aria-hidden>
            {[{ x: 14, h: 12, p: PEACH, c: YELLOW }, { x: 58, h: 16, p: YELLOW, c: ORANGE }, { x: 101, h: 10, p: ORANGE, c: GOLD }].map((f) => (
              <g key={f.x}>
                <path d={`M${f.x} 22V${22 - f.h}`} stroke={GREEN_DARK} strokeWidth={1} />
                <Flower x={f.x} y={22 - f.h} r={2.2} petal={f.p} center={f.c} />
              </g>
            ))}
          </svg>
        </>
      );
    case "grass":
      return <GrassStrip />;
    case "swirls":
      return <><SwirlSide /><SwirlSide right /></>;
    case "hearts":
      return <HeartCorners />;
    case "streak":
      // Zakreslacz pod CALYM opisem (nie pod jedna linia) - nierowne krawedzie jak pociagniecie
      // markerem. Tekst jest prawie czarny-szary, wiec na zoltym czyta sie jak na papierze.
      return (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute -inset-x-1 -inset-y-0.5 h-[calc(100%+4px)] w-[calc(100%+8px)]" aria-hidden>
          <path d="M4 5C20 1 70 2.5 94 4.5c4.6.6 4.4 7 1.8 11.4 3 4.8 3 11.8-.4 15.6C82 37 26 37.6 6 35.6 1.4 34.6 1 28 3.6 23 .8 18 .8 9.6 4 5Z" fill={YELLOW} />
        </svg>
      );
  }
}

// Serca potrzebuja wlasnej skali (nie moga sie rozciagac z pudelkiem), wiec leza w dwoch
// malych svg przy narozach zamiast w jednym rozciaganym.
function HeartCorners() {
  return (
    <>
      <svg viewBox="0 0 22 18" className="absolute -right-2 -top-3 h-[23px] w-[28px]" aria-hidden>
        <Heart x={8} y={0} s={1.1} fill={ORANGE} />
        <Heart x={1} y={8} s={0.6} fill={GOLD} />
      </svg>
      <svg viewBox="0 0 20 16" className="absolute -bottom-2.5 -left-2 h-5 w-[25px]" aria-hidden>
        <Heart x={0} y={3} s={0.95} fill={PEACH} />
        <Heart x={12} y={0} s={0.5} fill={ORANGE} />
      </svg>
    </>
  );
}

/** Opis profilu w ramce. Bez `kind` = sam tekst, bez zadnego paddingu (wyglad sprzed ramek). */
export default function BioFrame({ kind, children, className }: { kind: BioFrameKind | null | undefined; children: ReactNode; className?: string }) {
  if (!kind) return <>{children}</>;
  const bottomRoom = kind === "grass" || kind === "meadow";
  return (
    <div className={cn("relative", kind === "streak" ? "px-2.5 py-2" : kind === "swirls" ? "px-5 py-1.5" : "px-3 py-2", bottomRoom && "pb-4", className)}>
      <Decoration kind={kind} />
      <div className="relative">{children}</div>
    </div>
  );
}
