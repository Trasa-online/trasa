import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Ikona kategorii miejsca (SVG z /public, przez categoryIconSrc). Zastepuje emoji
// w calej aplikacji (etykiety kategorii, filtry, placeholdery). ZERO emoji w UI.
// - inline (etykieta/filtr): domyslnie h-4 w-4, ustaw wlasny className wg kontekstu.
// - placeholder miniaturki: owin w tlo #fcede3 i podaj wiekszy className.
export function CategoryIcon({ category, className }: { category?: string | null; className?: string }) {
  return (
    <img
      src={categoryIconSrc(category)}
      alt=""
      className={className ?? "h-4 w-4"}
      draggable={false}
    />
  );
}
