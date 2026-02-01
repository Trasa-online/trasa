import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical pin info returned when checking if a location already exists.
 */
export interface CanonicalPinInfo {
  isExisting: boolean;
  canonicalPinId?: string;
  discoveredByUserId?: string;
  discoveredByUsername?: string;
  discoveredByAvatar?: string;
  discoveredAt?: string;
  totalVisits?: number;
  averageRating?: number;
}

/**
 * Get full canonical pin info for a location (within ~50m radius).
 * Returns discovery info, visit count, and average rating if the place exists.
 */
export async function getCanonicalPinInfo(
  latitude: number | undefined,
  longitude: number | undefined
): Promise<CanonicalPinInfo> {
  if (!latitude || !longitude) {
    return { isExisting: false };
  }

  try {
    // Call RPC to find nearby canonical pin
    const { data: nearbyPinId, error: searchError } = await supabase.rpc('find_nearby_canonical_pin', {
      search_lat: latitude,
      search_lng: longitude,
      radius_meters: 50
    });

    if (searchError) {
      console.error('Error finding nearby canonical pin:', searchError);
      return { isExisting: false };
    }

    if (!nearbyPinId) {
      return { isExisting: false };
    }

    // Fetch full canonical pin data with discoverer profile
    const { data: canonicalPin, error: fetchError } = await supabase
      .from('canonical_pins')
      .select(`
        id,
        total_visits,
        average_rating,
        discovered_at,
        discovered_by_user_id,
        discovered_by:profiles!canonical_pins_discovered_by_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .eq('id', nearbyPinId)
      .maybeSingle();

    if (fetchError || !canonicalPin) {
      console.error('Error fetching canonical pin:', fetchError);
      return { isExisting: false };
    }

    // Handle the discovered_by relation (it's an object, not array)
    const discoveredBy = canonicalPin.discovered_by as { username?: string; avatar_url?: string } | null;

    return {
      isExisting: true,
      canonicalPinId: canonicalPin.id,
      discoveredByUserId: canonicalPin.discovered_by_user_id || undefined,
      discoveredByUsername: discoveredBy?.username || undefined,
      discoveredByAvatar: discoveredBy?.avatar_url || undefined,
      discoveredAt: canonicalPin.discovered_at || undefined,
      totalVisits: canonicalPin.total_visits || 0,
      averageRating: canonicalPin.average_rating || 0,
    };
  } catch (error) {
    console.error('Error in getCanonicalPinInfo:', error);
    return { isExisting: false };
  }
}

/**
 * Find the original creator of a pin location (within ~50m radius).
 * Returns the user_id of whoever first added a pin at this location.
 * @deprecated Use getCanonicalPinInfo instead for full data
 */
export async function findOriginalPinCreator(
  latitude: number | undefined,
  longitude: number | undefined
): Promise<string | null> {
  if (!latitude || !longitude) return null;

  const { data, error } = await supabase.rpc('find_original_pin_creator', {
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) {
    console.error('Error finding original pin creator:', error);
    return null;
  }

  return data || null;
}

/**
 * Check if a similar pin exists nearby and return discovery info.
 * @deprecated Use getCanonicalPinInfo instead for full data
 */
export async function checkPinDiscoveryInfo(
  latitude: number | undefined,
  longitude: number | undefined
): Promise<{
  isDiscovered: boolean;
  originalCreatorId: string | null;
  originalCreatorUsername: string | null;
} | null> {
  if (!latitude || !longitude) return null;

  const originalCreatorId = await findOriginalPinCreator(latitude, longitude);
  
  if (!originalCreatorId) return null;

  // Fetch the username
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', originalCreatorId)
    .single();

  return {
    isDiscovered: true,
    originalCreatorId,
    originalCreatorUsername: profile?.username || null,
  };
}
