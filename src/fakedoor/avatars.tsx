// Awatary autorow - LOKALNE, generowane inline SVG (zero sieci, zawsze sie
// renderuja). Wczesniej DiceBear (zewnetrzny) nie ladowal sie na live - stad
// wlasny generator "twarzy": kolor tla + akcent + oczy + usmiech, wszystko
// deterministyczne z seeda, wiec kazdy profil ma stala, unikalna twarz.

const PALETTE = [
  "#F9662B", "#2BB673", "#3DA5D9", "#7B61FF", "#E84393",
  "#00B894", "#FFB020", "#5C7CFA", "#FF7A59", "#12B5CB",
];

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
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function AuthorAvatar({
  seed,
  name,
  size = 20,
  className = "",
}: {
  seed: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const h = hash(seed);
  const rand = mulberry32(h);
  const bg = PALETTE[h % PALETTE.length];
  const accent = PALETTE[(h >> 4) % PALETTE.length];

  const cx = 18;
  const eyeY = 15 + Math.round(rand() * 2); // 15-17
  const spread = 4.5 + rand() * 1.5;
  const smile = rand() > 0.35;
  const accentX = rand() * 36;
  const accentY = 6 + rand() * 8;

  return (
    <svg
      viewBox="0 0 36 36"
      role="img"
      aria-label={name}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size, display: "block" }}
    >
      <rect width="36" height="36" fill={bg} />
      {/* miekki akcent dla charakteru */}
      <circle cx={accentX} cy={accentY} r="11" fill={accent} opacity="0.35" />
      {/* oczy */}
      <g fill="#0E0E0E" fillOpacity="0.82">
        <circle cx={cx - spread} cy={eyeY} r="1.7" />
        <circle cx={cx + spread} cy={eyeY} r="1.7" />
      </g>
      {/* usta */}
      {smile ? (
        <path
          d={`M${cx - 5.5} ${eyeY + 4.5} Q${cx} ${eyeY + 8.5} ${cx + 5.5} ${eyeY + 4.5}`}
          fill="none"
          stroke="#0E0E0E"
          strokeOpacity="0.82"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={cx - 4.5}
          y1={eyeY + 5.5}
          x2={cx + 4.5}
          y2={eyeY + 5.5}
          stroke="#0E0E0E"
          strokeOpacity="0.82"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
