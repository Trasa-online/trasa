import { Folder, FileText, MapPin, Users } from "lucide-react";
import { haptics } from "@/hooks/useHaptics";

// Wiersz kategorii wyszukiwarki (redesign wg Figmy "NEW - Eksploracja — wyszukiwarka").
// Karty nad polem wyszukiwania; aktywna ma peachy tlo + pomaranczowa obwodka.
// "Wyjazdy" ma znak marki (spontaway), reszta ikony Lucide (CLAUDE.md: tylko Lucide).
// Wspoldzielone przez Eksploracje i profil - wyszukiwarka wyglada tak samo w obu miejscach.
export type SearchCat = "all" | "lists" | "trips" | "places" | "people";

const SEARCH_CATS: { id: SearchCat; label: string; icon: "folder" | "file" | "brand" | "pin" | "people" }[] = [
  { id: "all", label: "Wszystko", icon: "folder" },
  { id: "lists", label: "Listy", icon: "file" },
  { id: "trips", label: "Wyjazdy", icon: "brand" },
  { id: "places", label: "Miejsca", icon: "pin" },
  { id: "people", label: "Ludzie", icon: "people" },
];

export default function SearchCategoryRow({ value, onChange }: { value: SearchCat; onChange: (c: SearchCat) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-3 pb-1 shrink-0">
      {SEARCH_CATS.map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => { haptics.selection(); onChange(c.id); }}
            aria-pressed={on}
            className="flex-1 min-w-0 flex flex-col items-center gap-1 active:scale-[0.97] transition-transform"
          >
            <span className={`w-full h-[76px] rounded-[10px] border flex items-center justify-center transition-colors ${on ? "border-[#F0A583] bg-orange-100/30" : "border-border bg-transparent"}`}>
              {c.icon === "brand" ? (
                <img src="/spontaway-symbol.png" alt="" className="h-6 w-[27px] object-contain" />
              ) : c.icon === "folder" ? (
                <Folder className={`h-6 w-6 ${on ? "text-[#F0A583]" : "text-foreground"}`} strokeWidth={1.8} />
              ) : c.icon === "file" ? (
                <FileText className="h-6 w-6 text-foreground" strokeWidth={1.8} />
              ) : c.icon === "people" ? (
                <Users className="h-6 w-6 text-foreground" strokeWidth={1.8} />
              ) : (
                // Konturowa pinezka - bez wypelnienia, spojnie z reszta ikon w wierszu.
                <MapPin className="h-6 w-6 text-foreground" strokeWidth={1.8} />
              )}
            </span>
            <span className="text-xs font-medium text-foreground leading-4 truncate">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
