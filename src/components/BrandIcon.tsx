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
