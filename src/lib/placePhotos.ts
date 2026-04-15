/**
 * Returns a URL routed through our Edge proxy (/api/place-photo).
 * The proxy adds Cache-Control: immutable so Vercel CDN serves each photo
 * from cache after the first request — Google is billed only once per unique photo_reference.
 */
export function getPhotoUrl(photoReference: string, maxWidth = 800): string | null {
  if (!photoReference) return null;
  return `/api/place-photo?ref=${encodeURIComponent(photoReference)}&w=${maxWidth}`;
}
