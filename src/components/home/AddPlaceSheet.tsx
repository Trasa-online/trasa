import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, MapPin, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { forwardGeocodeWithTypes } from "@/lib/googleMaps";

interface PlaceResult {
  name: string;
  full_address: string;
  latitude?: number;
  longitude?: number;
}

interface AddPlaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, details?: PlaceResult) => void;
}

const AddPlaceSheet = ({ open, onOpenChange, onAdd }: AddPlaceSheetProps) => {
  const { t } = useTranslation("homecreator");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    } else {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const r = await forwardGeocodeWithTypes(query.trim());
      setResults(r);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleAdd = (name: string, details?: PlaceResult) => {
    onAdd(name, details);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl flex flex-col" style={{ maxHeight: "75vh" }}>
        <SheetHeader className="pb-2 shrink-0">
          <SheetTitle className="text-left">{t("add_place.title")}</SheetTitle>
        </SheetHeader>

        <div className="relative shrink-0 mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("add_place.search_placeholder")}
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-foreground/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {query.trim() && (
            <button
              onClick={() => handleAdd(query.trim())}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/50 text-left"
            >
              <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("add_place.add_custom", { query: query.trim() })}</p>
                <p className="text-xs text-muted-foreground">{t("add_place.no_verification")}</p>
              </div>
            </button>
          )}

          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleAdd(r.name, r)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/50 text-left"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.full_address}</p>
              </div>
            </button>
          ))}

          {!query.trim() && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("add_place.empty")}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddPlaceSheet;
