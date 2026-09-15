// Miniatura miejsca na liscie. Gdy zdjecia nie ma, rysuje IKONE KATEGORII na peachowym
// tle - dokladnie tak, jak robi to aplikacja (patrz CLAUDE.md: fallback zdjecia miejsca
// = `categoryIconSrc()` na #fcede3, zero emoji). Szara pinezka w tym miejscu nie mowila
// nic poza "brak", a operatorka i tak musi wiedziec, z jakim lokalem ma do czynienia.
//
// Peach ma WLASNE tlo i WLASNY kolor ikony, wiec czyta sie tak samo w obu trybach panelu.
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { cn } from "@/lib/utils";

export function Thumb({ url, category, className }: {
  url: string | null;
  category?: string | null;
  className?: string;
}) {
  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)]", className ?? "h-9 w-9");
  if (url) {
    return (
      <span className={cn(box, "bg-[var(--photo)]")}>
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={box} style={{ background: "#FCEDE3" }} title="Brak zdjęcia w bazie">
      <img src={categoryIconSrc(category)} alt="" className="h-1/2 w-1/2 object-contain" />
    </span>
  );
}
