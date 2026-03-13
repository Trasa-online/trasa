import { supabase } from "@/integrations/supabase/client";

// Google Maps API Key
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCdZ-on1_mKr1Q9OTDYkqkk4OzB7SwR32M';

// Reverse Geocoding (Coordinates → Address)
export const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=pl`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        placeName: result.address_components[0]?.long_name || '',
        fullAddress: result.formatted_address
      };
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

// Place type detection from Google types array
export type PlaceCategory = 'transport' | 'accommodation' | 'attraction' | 'food' | 'shopping' | 'other';

const PLACE_TYPE_MAP: Record<string, PlaceCategory> = {
  // Transport
  airport: 'transport', train_station: 'transport', bus_station: 'transport',
  transit_station: 'transport', subway_station: 'transport', ferry_terminal: 'transport',
  light_rail_station: 'transport',
  // Accommodation
  lodging: 'accommodation', hotel: 'accommodation', motel: 'accommodation',
  campground: 'accommodation',
  // Attraction
  museum: 'attraction', amusement_park: 'attraction', tourist_attraction: 'attraction',
  park: 'attraction', zoo: 'attraction', aquarium: 'attraction', art_gallery: 'attraction',
  church: 'attraction', stadium: 'attraction', movie_theater: 'attraction',
  // Food
  restaurant: 'food', cafe: 'food', bakery: 'food', bar: 'food',
  meal_delivery: 'food', meal_takeaway: 'food', food: 'food',
  // Shopping
  shopping_mall: 'shopping', store: 'shopping', clothing_store: 'shopping',
  book_store: 'shopping', convenience_store: 'shopping', supermarket: 'shopping',
  department_store: 'shopping', jewelry_store: 'shopping',
};

export const detectPlaceType = (types: string[]): PlaceCategory => {
  for (const type of types) {
    if (PLACE_TYPE_MAP[type]) return PLACE_TYPE_MAP[type];
  }
  return 'other';
};

// Forward Geocoding with Place Types (via server-side proxy to avoid CORS)
export const forwardGeocodeWithTypes = async (query: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("google-places-proxy", {
      body: { action: "textsearch", query },
    });
    if (error || !data?.results) return [];
    return (data.results as { name: string; full_address: string; latitude: number; longitude: number }[]);
  } catch (error) {
    console.error('Forward geocode with types error:', error);
    return [];
  }
};

// Legacy forward geocoding (kept for backward compatibility)
export const forwardGeocode = async (query: string) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=pl`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      return data.results.map((result: any) => ({
        name: result.address_components[0]?.long_name || '',
        full_address: result.formatted_address,
        coordinates: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng
        }
      }));
    }
    return [];
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return [];
  }
};

// Common marker styles
export const createMarkerStyle = (index: number) => ({
  width: '28px',
  height: '28px',
  background: '#000',
  border: '2px solid white',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '12px',
  fontWeight: '600',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  cursor: 'pointer'
} as const);
