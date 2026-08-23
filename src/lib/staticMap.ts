import { API_BASE } from "@/lib/platform";

// Statyczna mapka trasy (podglad): numerowane peachy piny z miejsc trasy. Zwraca null gdy brak
// wspolrzednych. Uzywane w podsumowaniu trasy (ReviewSummary) oraz na kafelku wyjazdu (profil).
// Proxy /api/static-map trzyma klucz Google server-side + cache CDN (patrz api/static-map.ts).
export function buildTripStaticMapUrl(pins: any[], size = "560x260"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!pts.length) return null;
  // Numerowane peachy piny (label 1-9; Google static przyjmuje 1 znak - dla 10+ bez numeru).
  const markers = pts.map((p, i) => {
    const label = i + 1 <= 9 ? `label:${i + 1}%7C` : "";
    return `markers=color:0xf0a583%7C${label}${p.latitude},${p.longitude}`;
  }).join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}
