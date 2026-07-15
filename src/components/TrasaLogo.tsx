import { cn } from "@/lib/utils";

/**
 * Znak Trasy (pomaranczowe logo) ZAWSZE w bialym kolku (#FAFAFA) - nigdy
 * "zawieszony w powietrzu" sam. Globalna zasada brandowa (patrz CLAUDE.md).
 *
 * size = srednica kolka w px. Logo renderowane wewnatrz na ~58% srednicy,
 * wycentrowane. Subtelny cien + ring, zeby kolko odcinalo sie od zblizonych
 * jasnych tel (#FEFEFE / slate-50) i wygladalo dobrze rowniez na ciemnych.
 */
export function TrasaLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/[0.06]",
        className,
      )}
      style={{ width: size, height: size, background: "#FAFAFA" }}
    >
      <img
        src="/Icon_Trasa.png"
        alt="Trasa"
        draggable={false}
        className="object-contain select-none"
        style={{ width: Math.round(size * 0.58), height: Math.round(size * 0.58) }}
      />
    </div>
  );
}

export default TrasaLogo;
