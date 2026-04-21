/**
 * Returns a URL routed through our Edge proxy (/api/place-photo).
 * Supports both Old Places API (CmRaAAAA... format) and New Places API (AU_... format).
 * For AU_ references, placeId is required to build the correct v1 photo name.
 */
export function getPhotoUrl(photoReference: string, maxWidth = 800, placeId?: string): string | null {
  if (!photoReference) return null;
  const ref = encodeURIComponent(photoReference);
  const base = `/api/place-photo?ref=${ref}&w=${maxWidth}`;
  if (photoReference.startsWith("AU_") && placeId) {
    return `${base}&place_id=${encodeURIComponent(placeId)}`;
  }
  return base;
}
