// Ikona z brandowego zestawu SVG (public/Ikona_*.svg) rysowana przez CSS mask + currentColor:
// przejmuje kolor tekstu rodzica (text-primary, text-muted-foreground...) tak samo jak ikony
// lucide, wiec da sie ja stosowac zamiennie. Ten sam mechanizm co NavIcon w dolnym pasku.
export function BrandIcon({ src, className = "h-4 w-4", label }: { src: string; className?: string; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}

/** Gwiazdka „topki" (Ikona_Gwiazdka.svg od Nat, 2026-09-11) - zamiast gwiazdki lucide. */
export const STAR_ICON = "/Ikona_Gwiazdka.svg";

/** Wypelniona ikona list (Ikona_Listy_Listy.svg od Nat, 2026-09-11) - zakladka Listy na profilu,
 *  kafelki list w eksploracji i kategoria „Listy" w wyszukiwarce. Zastapila lucide FileText/LayoutGrid. */
export const LIST_ICON = "/Ikona_Listy_Listy.svg";

/** Brandowa zakladka „zapisz" (Ikona_Zapisane.svg) - guziki zapisu miejsca/wyjazdu/listy,
 *  zamiast lucide `Bookmark` (prosba Nat 2026-09-13). */
export const SAVE_ICON = "/Ikona_Zapisane.svg";

/** Brandowy aparat (public/aparat.svg od Nat, 2026-09-13) - "dodaj zdjecie do miejsca". */
export const CAMERA_ICON = "/aparat.svg";

/** Brandowe serce (public/Ikona_serce.svg od Nat, 2026-09-13) - pelne, przez maske; wariant
 *  z konturem (przelacznik polubienia) = `BrandHeart` w BrandHeart.tsx. */
export const HEART_ICON = "/Ikona_serce.svg";

/** Brandowy PLUS (dwie kreski z Ikona_Dodaj.svg, bez kolka) - guziki "Dodaj" (2026-09-14). */
export const PLUS_ICON = "/Ikona_Plus.svg";

// ─── Ikony akcji od Nat (2026-09-18) - zamiast lucide ─────────────────────────
// Osiem rysunkow w tym samym stylu co zestaw nawigacji (public/Ikona_*.svg, viewBox 30x38):
// mapa, galeria, udostepnij, czat, kalendarz, blokuj, flaga, kosz. Komponenty maja ten sam
// interfejs co ikony lucide (`className` steruje rozmiarem i kolorem), wiec podmiana w JSX
// to sama nazwa znacznika; `strokeWidth` i inne propsy lucide sa ignorowane.
// ⛔ W warstwach ANIMOWANYCH (kafelki, arkusze z transformem) maska CSS potrafi zniknac w WebKit
// - tam zostaje inline svg (patrz BrandStar / BrandHeart). Tu chodzi o statyczne guziki i menu.
export const MAP_ICON = "/Ikona_Mapa.svg";
export const GALLERY_ICON = "/Ikona_Galeria.svg";
export const SHARE_ICON = "/Ikona_Udostepnij.svg";
export const CHAT_ICON = "/Ikona_Czat.svg";
export const CALENDAR_ICON = "/Ikona_Kalendarz.svg";
export const BLOCK_ICON = "/Ikona_Blokuj.svg";
export const FLAG_ICON = "/Ikona_Flaga.svg";
export const TRASH_ICON = "/Ikona_Kosz.svg";

type IconProps = { className?: string; label?: string; [extra: string]: unknown };
const brand = (src: string) => ({ className, label }: IconProps) => <BrandIcon src={src} className={className} label={label} />;
export const BrandMap = brand(MAP_ICON);
export const BrandGallery = brand(GALLERY_ICON);
export const BrandShare = brand(SHARE_ICON);
export const BrandChat = brand(CHAT_ICON);
export const BrandCalendar = brand(CALENDAR_ICON);
export const BrandBlock = brand(BLOCK_ICON);
export const BrandFlag = brand(FLAG_ICON);
export const BrandTrash = brand(TRASH_ICON);
