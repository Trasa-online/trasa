import { supabase } from "@/integrations/supabase/client";

/**
 * Find the original creator of a pin location (within ~50m radius).
 * Returns the user_id of whoever first added a pin at this location.
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
