// Dekoracyjna mini-mapka trasy (SVG). Deterministyczna z seeda (id trasy),
// zeby ksztalt byl stabilny miedzy renderami. Nie jest to prawdziwa mapa -
// odwzorowuje sygnaturowy element karty z apki (miniaturka trasy w rogu okladki)
// bez fejkowania Google Maps ani ryzyka pustych kafli.

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function MiniMap({ seed, className }: { seed: string; className?: string }) {
  const rand = mulberry32(hash(seed));
  const n = 4 + Math.floor(rand() * 2); // 4-5 przystankow
  const pts = Array.from({ length: n }, () => ({
    x: 16 + rand() * 68,
    y: 16 + rand() * 68,
  }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="100" height="100" fill="#eaf0f6" />
      {/* subtelna siatka */}
      {[25, 50, 75].map((v) => (
        <g key={v} stroke="#d3ddea" strokeWidth="0.8">
          <line x1={v} y1="0" x2={v} y2="100" />
          <line x1="0" y1={v} x2="100" y2={v} />
        </g>
      ))}
      {/* trasa */}
      <path d={path} fill="none" stroke="#F9662B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.4" fill="#ffffff" stroke="#F9662B" strokeWidth="2" />
      ))}
    </svg>
  );
}
