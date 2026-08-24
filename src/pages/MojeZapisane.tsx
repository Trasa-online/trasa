import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark } from "lucide-react";
import { SavedPlacesGrid } from "@/components/saved/SavedPlacesGrid";

// Widok listy OGÓLNEJ usera - wszystkie zapisane miejsca (wishlista to_visit, agregat).
// Domyślna lista każdego usera; wejście z karty "Ogólne" na profilu. Reuse SavedPlacesGrid.
export default function MojeZapisane() {
  const navigate = useNavigate();
  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
      <div className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border/40" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/moj-profil"))} aria-label="Wróć"
          className="h-9 w-9 -ml-2 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-full bg-[#fcede3] flex items-center justify-center shrink-0">
            <Bookmark className="h-4 w-4 text-orange-500 fill-orange-500" />
          </span>
          <h1 className="text-lg font-black text-foreground truncate">Ogólne</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Wszystkie Twoje zapisane miejsca. Zapisuj przez „Zapisz" przy dowolnym miejscu.
        </p>
        <SavedPlacesGrid />
      </div>
    </div>
  );
}
