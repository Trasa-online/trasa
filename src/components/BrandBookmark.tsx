// Brandowa zakladka „zapisz" (Ikona_Zapisane.svg od Nat) jako INLINE svg - sciezka 1:1 z pliku.
// Odpowiednik BrandStar/BrandHeart. Rysunek jest ten sam, co w `BrandIcon src={SAVE_ICON}`, ale
// bez CSS maski: na kafelkach eksploracji WebKit na iOS gubil `-webkit-mask-image` i ikona po
// prostu znikala (ten sam blad, co z gwiazdkami w nakladce awatara, 2026-09-13).
export const BOOKMARK_VIEWBOX = "0 0 338.72 424.15";
export const BOOKMARK_PATH = "M194.58,339.32c-14.85-13.6-34.86-11.8-49.75.41l-66.64,54.61-32.24,25.62c-10.65,8.47-25.77,3.47-31.43-9.34-5.26-11.91-6.91-25.16-8.46-38.94C-4.23,280.33-1.99,158.43,17.17,69.04c4.73-22.07,19.2-37.08,41.13-43.5C126.15,5.67,231.47-9.93,298.07,7.64c17,4.49,28.04,17.77,32.14,34.68,6.61,27.25,8.31,54.13,8.48,83.04.5,84.76-7.62,168.25-22.62,251.45-3.14,17.4-8.23,38.01-22.95,41.64-5.42,1.34-14.85-.58-19.03-4.63l-33.22-32.1-46.3-42.4Z";

export function BrandBookmark({ filled = true, className = "", strokeWidth = 30 }: { filled?: boolean; className?: string;
  /** Grubosc konturu w jednostkach viewBoxa (339 x 424): 30 = ~1,8 px przy 22 px szerokosci. */
  strokeWidth?: number }) {
  return (
    <svg viewBox={BOOKMARK_VIEWBOX} className={className} aria-hidden style={{ overflow: "visible" }}>
      <path d={BOOKMARK_PATH} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={filled ? 0 : strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
