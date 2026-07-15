import { cn } from "@/lib/utils";

/**
 * Znak Trasy w kolku - wariant "reverse" (jak ikona aplikacji natywnej):
 * POMARANCZOWE kolo (gradient #F4A259 -> #F9662B) z BIALYM znakiem w srodku.
 * Bialy znak uzyskany filtrem CSS (brightness(0) invert(1)) z pomaranczowego
 * Icon_Trasa.png - nie trzeba osobnego assetu.
 *
 * Globalna zasada brandowa (patrz CLAUDE.md): znak Trasy nigdy "zawieszony
 * w powietrzu" sam - zawsze w tym kolku. size = srednica kolka w px.
 */
export function TrasaLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-full flex items-center justify-center shrink-0 shadow-sm", className)}
      style={{ width: size, height: size, background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
    >
      <img
        src="/Icon_Trasa.png"
        alt="Trasa"
        draggable={false}
        className="object-contain select-none"
        style={{
          width: Math.round(size * 0.56),
          height: Math.round(size * 0.56),
          filter: "brightness(0) invert(1)", // pomaranczowy znak -> bialy
        }}
      />
    </div>
  );
}

export default TrasaLogo;
