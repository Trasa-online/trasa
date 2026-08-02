import { useState } from "react";

// Zroznicowane awatary autorow tras. DiceBear (SVG, deterministyczny per seed,
// zawsze sie renderuje) - kazdemu autorowi przypisany INNY styl, zeby feed nie
// wygladal generycznie. Fallback: kolorowe kolko z inicjalem (gdyby DiceBear
// nie odpowiedzial w trakcie kampanii - nigdy zlamany obrazek).

const STYLES = [
  "adventurer",
  "lorelei",
  "notionists",
  "avataaars",
  "big-smile",
  "open-peeps",
  "fun-emoji",
  "personas",
  "miniavs",
  "thumbs",
  "bottts",
  "big-ears",
];

const BG = ["ffd5dc", "d1f4e0", "ffe8c8", "d9e4ff", "f3d9ff", "d9f7ff"];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarUrl(seed: string): string {
  const h = hash(seed);
  const style = STYLES[h % STYLES.length];
  const bg = BG[(h >> 5) % BG.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundColor=${bg}`;
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
  const [ok, setOk] = useState(true);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "T";

  if (!ok) {
    return (
      <span
        className={`flex items-center justify-center rounded-full bg-orange-100 font-bold text-[#F9662B] ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl(seed)}
      alt={name}
      loading="lazy"
      onError={() => setOk(false)}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size, background: "#fff" }}
    />
  );
}
