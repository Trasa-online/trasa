import { parseISO, isValid } from "date-fns";

// Kompaktowy wzgledny czas dla kart feedu profilu (Figma: "14m", "3d").
// Zwraca krotki string PL. Uzywa Date.now() - tylko runtime aplikacji.
export function shortRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  if (!isValid(d)) return "";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "teraz";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  const w = Math.floor(dd / 7);
  if (w < 5) return `${w} tyg`;
  const mo = Math.floor(dd / 30);
  if (mo < 12) return `${mo} mies`;
  return `${Math.floor(dd / 365)} lat`;
}
