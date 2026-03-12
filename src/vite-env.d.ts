/// <reference types="vite/client" />

declare namespace NodeJS {
  interface Timeout {}
}

declare namespace google {
  namespace maps {
    class Geocoder {
      geocode(request: any, callback?: any): Promise<any>;
    }
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    class LatLngBounds {
      constructor(sw?: any, ne?: any);
      extend(point: any): this;
    }
    namespace places {
      class AutocompleteService {
        getPlacePredictions(request: any, callback?: any): Promise<any>;
      }
      class PlacesService {
        constructor(attrContainer: any);
        getDetails(request: any, callback: any): void;
      }
    }
  }
}
