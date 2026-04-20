export interface Subcategory {
  id: string;
  label: string;
  emoji: string;
}

export interface MainCategory {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  subcategories: Subcategory[];
}

export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 'food',
    label: 'Jedzenie & Napoje',
    emoji: '🍽️',
    hint: 'Restauracje · Kawiarnie · Bary',
    subcategories: [
      { id: 'restaurant', label: 'Restauracja', emoji: '🍴' },
      { id: 'cafe',       label: 'Kawiarnia',   emoji: '☕' },
      { id: 'bar',        label: 'Bar / Pub',   emoji: '🍺' },
    ],
  },
  {
    id: 'culture',
    label: 'Kultura & Historia',
    emoji: '🏛️',
    hint: 'Muzea · Zabytki · Galerie',
    subcategories: [
      { id: 'museum',   label: 'Muzeum',   emoji: '🏛️' },
      { id: 'monument', label: 'Zabytek',  emoji: '🏰' },
      { id: 'gallery',  label: 'Galeria',  emoji: '🖼️' },
    ],
  },
  {
    id: 'attractions',
    label: 'Atrakcje',
    emoji: '✨',
    hint: 'Doświadczenia · Targi · Zakupy',
    subcategories: [
      { id: 'experience', label: 'Doświadczenie', emoji: '🎭' },
      { id: 'market',     label: 'Targ',          emoji: '🏪' },
      { id: 'shopping',   label: 'Sklep',         emoji: '🛍️' },
      { id: 'club',       label: 'Klub',          emoji: '🎵' },
    ],
  },
  {
    id: 'nature',
    label: 'Natura & Widoki',
    emoji: '🌿',
    hint: 'Parki · Punkty widokowe',
    subcategories: [
      { id: 'park',      label: 'Park',             emoji: '🌳' },
      { id: 'viewpoint', label: 'Punkt widokowy',   emoji: '🌅' },
    ],
  },
];

export const getSubcategoryIds = (mainCategoryId: string): string[] => {
  const cat = MAIN_CATEGORIES.find(c => c.id === mainCategoryId);
  return cat ? cat.subcategories.map(s => s.id) : [];
};

export const getMainCategoryFor = (subcategoryId: string): MainCategory | undefined =>
  MAIN_CATEGORIES.find(c => c.subcategories.some(s => s.id === subcategoryId));

export const getSubcategoryLabel = (subcategoryId: string): string | undefined => {
  for (const cat of MAIN_CATEGORIES) {
    const sub = cat.subcategories.find(s => s.id === subcategoryId);
    if (sub) return sub.label;
  }
  return undefined;
};
