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

// Forward Geocoding (Address → Coordinates)
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
