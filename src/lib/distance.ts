// Dystans geograficzny (haversine) + formatowanie do UI. Czysto client-side,
// nic nie zapisujemy na serwer. Wspoldzielone przez chip dystansu na karcie swipera,
// w wizytowce i przy aktywnej trasie.

export interface LatLng { lat: number; lng: number }

// Dystans w km miedzy dwoma punktami lat/lng.
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// "X od Ciebie": < 1 km -> metry (zaokraglone do 50 m), < 10 km -> "X,X km", inaczej "X km".
// Polski separator dziesietny = przecinek.
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${m} m`;
  }
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
