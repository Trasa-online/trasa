import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Ikona kategorii miejsca (SVG z /public, przez categoryIconSrc). Zastepuje emoji
// w calej aplikacji (etykiety kategorii, filtry, placeholdery). ZERO emoji w UI.
// - inline (etykieta/filtr): domyslnie h-4 w-4, ustaw wlasny className wg kontekstu.
// - placeholder miniaturki: owin w tlo #fcede3 i podaj wiekszy className.
const FALLBACK_ICON = "/Ikona__Landmark.svg";

export function CategoryIcon({ category, className }: { category?: string | null; className?: string }) {
  return (
    <img
      src={categoryIconSrc(category)}
      alt=""
      className={className ?? "h-4 w-4"}
      draggable={false}
      // Natywny WebView bywa wrazliwy na brakujace/zle zakodowane sciezki (np. spacje w nazwie
      // pliku) - zamiast zlamanego obrazka pokaz ikone fallback (guard przed petla onError).
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src.endsWith(FALLBACK_ICON)) return;
        img.src = FALLBACK_ICON;
      }}
    />
  );
}
