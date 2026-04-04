import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

/**
 * Returns a direct Google Places photo URL.
 * No caching, no storage — compliant with Google Maps Platform ToS.
 */
export function getPhotoUrl(photoReference: string, maxWidth = 800): string | null {
  if (!photoReference || !GOOGLE_MAPS_API_KEY) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_MAPS_API_KEY}`;
}
