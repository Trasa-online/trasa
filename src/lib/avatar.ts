// Domyslny awatar "stan zero" - uzytkownik bez wlasnego zdjecia (brak Google/Apple OAuth photo
// ani uploadu). Pomaranczowa sylwetka na przezroczystym tle - wymaga jasnego podkladu (bg-orange-100).
export const DEFAULT_AVATAR = "/Avatar_Trasa.png";

// Zwraca zdjecie uzytkownika albo domyslny awatar Trasy.
export const avatarSrc = (url?: string | null): string => url || DEFAULT_AVATAR;
