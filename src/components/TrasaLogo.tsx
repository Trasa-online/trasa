import { cn } from "@/lib/utils";

/**
 * Znak spontaway - faliste "S". Rebrand 2026-08-04: wczesniej znak "T" w pomaranczowym
 * kolku (wariant reverse). Teraz marka = sam symbol na przezroczystym tle, BEZ kolka,
 * renderowany 1:1 z /spontaway-symbol.png (pomaranczowy).
 *
 * tone:
 *   "orange" (default) - pomaranczowy symbol (na jasnym tle).
 *   "white"            - bialy symbol (na pomaranczu/ciemnym tle, np. splash/loading),
 *                        uzyskany filtrem CSS z pomaranczowego zrodla.
 *
 * size = rozmiar boxu w px (symbol wpisany object-contain, footprint = size x size,
 * dzieki czemu wszystkie call-site zachowuja swoje wymiary).
 */
export function TrasaLogo({
  size = 48,
  tone = "orange",
  className,
}: {
  size?: number;
  tone?: "orange" | "white";
  className?: string;
}) {
  return (
    <img
      src="/spontaway-symbol.png"
      alt="spontaway"
      draggable={false}
      className={cn("object-contain select-none shrink-0", className)}
      style={{
        width: size,
        height: size,
        ...(tone === "white" ? { filter: "brightness(0) invert(1)" } : null),
      }}
    />
  );
}

export default TrasaLogo;
