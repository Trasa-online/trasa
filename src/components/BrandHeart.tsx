// Brandowe serce (Ikona_serce.svg od Nat, 2026-09-13) jako INLINE svg - sciezka 1:1 z pliku.
// Jak BrandStar: umie byc KONTUREM (`filled=false`), bo serce jest przelacznikiem polubienia
// wyjazdu w belce (puste = nie polubione, pelne = polubione). Zastapilo lucide `Heart`.
export const HEART_VIEWBOX = "0 0 512.39 424.15";
export const HEART_PATH = "M131.94,0C93.1,0,54.18,17.13,29.77,47.34,1.49,82.32-5.76,131.36,4.29,175.21c10.05,43.85,35.78,82.85,67.04,115.2,31.26,32.35,68.05,58.74,104.62,84.93,18.27,13.09,36.54,26.17,54.81,39.26,5.19,3.72,10.56,7.52,16.78,8.92,12.16,2.75,24.21-4.14,34.73-10.83,50.59-32.13,100.48-66.35,141.95-109.61,41.47-43.27,74.38-96.5,85.12-155.46,5.75-31.57,4.44-66.23-13.39-92.9-21.07-31.51-61.28-45.5-99.18-45.72-54.99-.31-109.42,25.5-144.52,67.72-4.22,5.07-12.15,4.6-15.67-.98C220.39,50.07,177.98,0,131.94,0Z";

export function BrandHeart({ filled = true, className = "", strokeWidth = 34 }: { filled?: boolean; className?: string;
  /** Grubosc konturu w jednostkach viewBoxa (512 x 424): 34 = ~1,9 px przy 28 px szerokosci. */
  strokeWidth?: number }) {
  return (
    <svg viewBox={HEART_VIEWBOX} className={className} aria-hidden>
      <path d={HEART_PATH} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={filled ? 0 : strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
