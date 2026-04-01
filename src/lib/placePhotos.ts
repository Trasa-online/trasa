import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/**
 * Get a cached photo URL for a Google Places photo_reference.
 * First call downloads & caches in Supabase Storage; subsequent calls return cached URL.
 */
export async function getCachedPhotoUrl(
  photoReference: string,
  maxWidth = 800
): Promise<string | null> {
  if (!photoReference) return null;

  // In-memory cache
  const memKey = `${photoReference}:${maxWidth}`;
  if (cache.has(memKey)) return cache.get(memKey)!;

  try {
    const { data, error } = await supabase.functions.invoke("google-places-proxy", {
      body: { action: "cache-photo", photo_reference: photoReference, maxwidth: maxWidth },
    });

    if (error || !data?.public_url) return null;

    cache.set(memKey, data.public_url);
    return data.public_url;
  } catch {
    return null;
  }
}
