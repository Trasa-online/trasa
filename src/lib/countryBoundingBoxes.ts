// Bounding boxes for popular tourist countries
// Format: { minLat, maxLat, minLng, maxLng }

export const COUNTRY_BOUNDING_BOXES: Record<string, { 
  minLat: number; 
  maxLat: number; 
  minLng: number; 
  maxLng: number;
  synonyms: string[];
}> = {
  // Europe
  hiszpania: { minLat: 35.9, maxLat: 43.8, minLng: -9.3, maxLng: 4.3, synonyms: ['spain', 'espana', 'españa'] },
  portugalia: { minLat: 36.9, maxLat: 42.2, minLng: -9.5, maxLng: -6.2, synonyms: ['portugal'] },
  francja: { minLat: 41.3, maxLat: 51.1, minLng: -5.1, maxLng: 9.6, synonyms: ['france'] },
  wlochy: { minLat: 35.5, maxLat: 47.1, minLng: 6.6, maxLng: 18.5, synonyms: ['italy', 'italia', 'włochy'] },
  niemcy: { minLat: 47.3, maxLat: 55.1, minLng: 5.9, maxLng: 15.0, synonyms: ['germany', 'deutschland'] },
  austria: { minLat: 46.4, maxLat: 49.0, minLng: 9.5, maxLng: 17.2, synonyms: ['austria', 'osterreich', 'österreich'] },
  szwajcaria: { minLat: 45.8, maxLat: 47.8, minLng: 5.9, maxLng: 10.5, synonyms: ['switzerland', 'schweiz', 'suisse'] },
  grecja: { minLat: 34.8, maxLat: 41.7, minLng: 19.4, maxLng: 29.6, synonyms: ['greece', 'hellas'] },
  chorwacja: { minLat: 42.4, maxLat: 46.5, minLng: 13.5, maxLng: 19.4, synonyms: ['croatia', 'hrvatska'] },
  czechy: { minLat: 48.5, maxLat: 51.1, minLng: 12.1, maxLng: 18.9, synonyms: ['czech', 'cesko', 'česko'] },
  polska: { minLat: 49.0, maxLat: 54.8, minLng: 14.1, maxLng: 24.1, synonyms: ['poland'] },
  holandia: { minLat: 50.8, maxLat: 53.5, minLng: 3.4, maxLng: 7.2, synonyms: ['netherlands', 'holland'] },
  belgia: { minLat: 49.5, maxLat: 51.5, minLng: 2.5, maxLng: 6.4, synonyms: ['belgium', 'belgique'] },
  wegry: { minLat: 45.7, maxLat: 48.6, minLng: 16.1, maxLng: 22.9, synonyms: ['hungary', 'magyarorszag', 'węgry'] },
  rumunia: { minLat: 43.6, maxLat: 48.3, minLng: 20.3, maxLng: 29.7, synonyms: ['romania'] },
  slowacja: { minLat: 47.7, maxLat: 49.6, minLng: 16.8, maxLng: 22.6, synonyms: ['slovakia', 'slovensko', 'słowacja'] },
  slowenia: { minLat: 45.4, maxLat: 46.9, minLng: 13.4, maxLng: 16.6, synonyms: ['slovenia', 'slovenija', 'słowenia'] },
  bulgaria: { minLat: 41.2, maxLat: 44.2, minLng: 22.4, maxLng: 28.6, synonyms: ['bulgaria', 'bułgaria'] },
  serbia: { minLat: 42.2, maxLat: 46.2, minLng: 18.8, maxLng: 23.0, synonyms: ['serbia'] },
  czarnogora: { minLat: 41.9, maxLat: 43.6, minLng: 18.4, maxLng: 20.4, synonyms: ['montenegro', 'czarnogóra'] },
  albania: { minLat: 39.6, maxLat: 42.7, minLng: 19.3, maxLng: 21.1, synonyms: ['albania'] },
  irlandia: { minLat: 51.4, maxLat: 55.4, minLng: -10.5, maxLng: -5.5, synonyms: ['ireland', 'eire'] },
  wielkabrytania: { minLat: 49.9, maxLat: 60.8, minLng: -8.6, maxLng: 1.8, synonyms: ['uk', 'britain', 'england', 'anglia', 'wielka brytania'] },
  szkocja: { minLat: 54.6, maxLat: 60.8, minLng: -8.6, maxLng: -0.7, synonyms: ['scotland'] },
  norwegia: { minLat: 57.9, maxLat: 71.2, minLng: 4.6, maxLng: 31.1, synonyms: ['norway', 'norge'] },
  szwecja: { minLat: 55.3, maxLat: 69.1, minLng: 11.1, maxLng: 24.2, synonyms: ['sweden', 'sverige'] },
  finlandia: { minLat: 59.8, maxLat: 70.1, minLng: 20.6, maxLng: 31.6, synonyms: ['finland', 'suomi'] },
  dania: { minLat: 54.6, maxLat: 57.8, minLng: 8.1, maxLng: 15.2, synonyms: ['denmark', 'danmark'] },
  islandia: { minLat: 63.3, maxLat: 66.5, minLng: -24.5, maxLng: -13.5, synonyms: ['iceland'] },
  cypr: { minLat: 34.6, maxLat: 35.7, minLng: 32.3, maxLng: 34.6, synonyms: ['cyprus', 'kypros'] },
  malta: { minLat: 35.8, maxLat: 36.1, minLng: 14.2, maxLng: 14.6, synonyms: ['malta'] },
  turcja: { minLat: 35.8, maxLat: 42.1, minLng: 26.0, maxLng: 44.8, synonyms: ['turkey', 'turkiye', 'türkiye'] },

  // Asia
  japonia: { minLat: 24.2, maxLat: 45.5, minLng: 122.9, maxLng: 153.9, synonyms: ['japan', 'nihon', 'nippon'] },
  korea: { minLat: 33.1, maxLat: 38.6, minLng: 124.6, maxLng: 131.9, synonyms: ['south korea', 'korea poludniowa', 'korea południowa'] },
  chiny: { minLat: 18.2, maxLat: 53.6, minLng: 73.5, maxLng: 134.8, synonyms: ['china', 'zhongguo'] },
  tajlandia: { minLat: 5.6, maxLat: 20.5, minLng: 97.3, maxLng: 105.6, synonyms: ['thailand', 'thai'] },
  wietnam: { minLat: 8.4, maxLat: 23.4, minLng: 102.1, maxLng: 109.5, synonyms: ['vietnam'] },
  indonezja: { minLat: -11.0, maxLat: 6.1, minLng: 95.0, maxLng: 141.0, synonyms: ['indonesia', 'bali'] },
  malezja: { minLat: 0.9, maxLat: 7.4, minLng: 99.6, maxLng: 119.3, synonyms: ['malaysia'] },
  singapur: { minLat: 1.2, maxLat: 1.5, minLng: 103.6, maxLng: 104.0, synonyms: ['singapore'] },
  filipiny: { minLat: 4.6, maxLat: 21.1, minLng: 116.9, maxLng: 126.6, synonyms: ['philippines'] },
  indie: { minLat: 6.7, maxLat: 35.5, minLng: 68.1, maxLng: 97.4, synonyms: ['india'] },
  nepal: { minLat: 26.4, maxLat: 30.4, minLng: 80.1, maxLng: 88.2, synonyms: ['nepal'] },
  srilanka: { minLat: 5.9, maxLat: 9.8, minLng: 79.7, maxLng: 81.9, synonyms: ['sri lanka', 'ceylon'] },
  kambodza: { minLat: 10.4, maxLat: 14.7, minLng: 102.3, maxLng: 107.6, synonyms: ['cambodia', 'kambodża'] },
  birma: { minLat: 9.8, maxLat: 28.5, minLng: 92.2, maxLng: 101.2, synonyms: ['myanmar', 'burma'] },
  laos: { minLat: 13.9, maxLat: 22.5, minLng: 100.1, maxLng: 107.7, synonyms: ['laos'] },
  mongolia: { minLat: 41.6, maxLat: 52.2, minLng: 87.7, maxLng: 119.9, synonyms: ['mongolia'] },
  tajwan: { minLat: 21.9, maxLat: 25.3, minLng: 120.0, maxLng: 122.0, synonyms: ['taiwan'] },
  hongkong: { minLat: 22.2, maxLat: 22.6, minLng: 113.8, maxLng: 114.4, synonyms: ['hong kong'] },

  // Middle East
  izrael: { minLat: 29.5, maxLat: 33.3, minLng: 34.3, maxLng: 35.9, synonyms: ['israel'] },
  jordania: { minLat: 29.2, maxLat: 33.4, minLng: 34.9, maxLng: 39.3, synonyms: ['jordan'] },
  zea: { minLat: 22.6, maxLat: 26.1, minLng: 51.5, maxLng: 56.4, synonyms: ['uae', 'emirates', 'dubaj', 'dubai', 'emiraty'] },
  oman: { minLat: 16.6, maxLat: 26.4, minLng: 52.0, maxLng: 59.8, synonyms: ['oman'] },
  katar: { minLat: 24.5, maxLat: 26.2, minLng: 50.8, maxLng: 51.6, synonyms: ['qatar'] },

  // Africa
  egipt: { minLat: 22.0, maxLat: 31.7, minLng: 24.7, maxLng: 36.9, synonyms: ['egypt'] },
  maroko: { minLat: 27.7, maxLat: 35.9, minLng: -13.2, maxLng: -1.0, synonyms: ['morocco', 'marocco'] },
  tunezja: { minLat: 30.2, maxLat: 37.5, minLng: 7.5, maxLng: 11.6, synonyms: ['tunisia'] },
  rpa: { minLat: -34.8, maxLat: -22.1, minLng: 16.5, maxLng: 32.9, synonyms: ['south africa', 'republika poludniowej afryki'] },
  kenia: { minLat: -4.7, maxLat: 4.6, minLng: 33.9, maxLng: 41.9, synonyms: ['kenya'] },
  tanzania: { minLat: -11.7, maxLat: -1.0, minLng: 29.3, maxLng: 40.4, synonyms: ['tanzania', 'zanzibar'] },

  // Americas
  usa: { minLat: 24.5, maxLat: 49.4, minLng: -125.0, maxLng: -66.9, synonyms: ['stany zjednoczone', 'ameryka', 'america', 'united states'] },
  kanada: { minLat: 41.7, maxLat: 83.1, minLng: -141.0, maxLng: -52.6, synonyms: ['canada'] },
  meksyk: { minLat: 14.5, maxLat: 32.7, minLng: -118.4, maxLng: -86.7, synonyms: ['mexico'] },
  brazylia: { minLat: -33.8, maxLat: 5.3, minLng: -73.9, maxLng: -34.8, synonyms: ['brazil', 'brasil'] },
  argentyna: { minLat: -55.1, maxLat: -21.8, minLng: -73.6, maxLng: -53.6, synonyms: ['argentina'] },
  chile: { minLat: -55.9, maxLat: -17.5, minLng: -75.6, maxLng: -66.4, synonyms: ['chile'] },
  peru: { minLat: -18.3, maxLat: -0.0, minLng: -81.3, maxLng: -68.7, synonyms: ['peru'] },
  kolumbia: { minLat: -4.2, maxLat: 12.5, minLng: -79.0, maxLng: -66.9, synonyms: ['colombia'] },
  kuba: { minLat: 19.8, maxLat: 23.2, minLng: -85.0, maxLng: -74.1, synonyms: ['cuba'] },
  kostaryka: { minLat: 8.0, maxLat: 11.2, minLng: -85.9, maxLng: -82.6, synonyms: ['costa rica'] },

  // Oceania
  australia: { minLat: -43.6, maxLat: -10.7, minLng: 113.2, maxLng: 153.6, synonyms: ['australia'] },
  nowazelandia: { minLat: -47.3, maxLat: -34.4, minLng: 166.4, maxLng: 178.6, synonyms: ['new zealand', 'nowa zelandia'] },
  fidzi: { minLat: -20.7, maxLat: -12.5, minLng: 177.0, maxLng: -179.0, synonyms: ['fiji', 'fidżi'] },
};

// Helper function to normalize country name for lookup
export const normalizeCountryName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
};

// Find country key by name or synonym
export const findCountryKey = (searchTerm: string): string | null => {
  const normalized = normalizeCountryName(searchTerm);
  
  // Direct match
  if (COUNTRY_BOUNDING_BOXES[normalized]) {
    return normalized;
  }
  
  // Search in synonyms
  for (const [key, data] of Object.entries(COUNTRY_BOUNDING_BOXES)) {
    if (data.synonyms.some(syn => normalizeCountryName(syn) === normalized)) {
      return key;
    }
  }
  
  return null;
};

// Check if coordinates are within country bounds
export const isInCountryBounds = (
  lat: number | null, 
  lng: number | null, 
  countryKey: string
): boolean => {
  if (lat === null || lng === null) return false;
  
  const bounds = COUNTRY_BOUNDING_BOXES[countryKey];
  if (!bounds) return false;
  
  return lat >= bounds.minLat && 
         lat <= bounds.maxLat && 
         lng >= bounds.minLng && 
         lng <= bounds.maxLng;
};
