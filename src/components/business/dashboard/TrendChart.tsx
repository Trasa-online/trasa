// Wykres ruchu wizytowki. Rysowany recznie w SVG, bez biblioteki: `recharts` siedzi
// w zaleznosciach, ale NIC go dzis nie importuje (patrz CLAUDE.md, sekcja Legacy),
// wiec dolozenie go tutaj dorzuciloby ~100 kB do paczki aplikacji dla jednego wykresu.
//
// Jedna seria, zero osi, zero siatki - z makiety „Spokojny panel". Lokal ma zobaczyc
// KIERUNEK, a nie czytac wartosci z kratki.
import { useId } from "react";

export interface TrendPoint { date: string; value: number }

export function TrendChart({ points, height = 220 }: { points: TrendPoint[]; height?: number }) {
  const gradientId = useId();
  if (points.length === 0) return null;

  const W = 1000;
  const H = height;
  const pad = 6;
  const max = Math.max(1, ...points.map((p) => p.value));
  // Jeden punkt (albo same zera) nie ma jak narysowac linii - rozciagamy go na cala szerokosc.
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * (W - pad * 2) + pad);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[180px] w-full md:h-[220px]" role="img">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F9662B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#F9662B" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#EE5307" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
