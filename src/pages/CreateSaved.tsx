import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useActiveCity } from "@/hooks/useActiveCity";
import CitySelect from "@/components/home/CitySelect";
import CreateTabs from "@/components/create/CreateTabs";
import { SavedRoutes, SavedCollections } from "@/components/home/DiscoveryFeed";
import { LikedTab } from "@/pages/Explore";
import { cn } from "@/lib/utils";

// Zakladka "Zapisane" huba tworzenia (/utworz/zapisane): to samo co zakladka Zapisane w dolnym
// pasku - segment Miejsca | Trasy | Listy (reuse LikedTab / SavedRoutes / SavedCollections).
type SavedTab = "places" | "routes" | "lists";

export default function CreateSaved() {
  const navigate = useNavigate();
  const [city, setCity] = useActiveCity();
  const [tab, setTab] = useState<SavedTab>("places");
  const close = () => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={close} aria-label="Zamknij" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1"><CreateTabs active="zapisane" /></div>
      </div>

      <div className="px-4 pt-3">
        <CitySelect city={city} onCityChange={setCity} allowAll />
      </div>

      <div className="px-4 pt-3">
        <div className="flex p-1 bg-secondary rounded-full">
          {([
            { id: "places", label: "Miejsca" },
            { id: "routes", label: "Trasy" },
            { id: "lists", label: "Listy" },
          ] as { id: SavedTab; label: string }[]).map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn("flex-1 h-9 rounded-full text-sm font-bold transition-colors active:scale-[0.98]",
                tab === s.id ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {tab === "places" ? <LikedTab city={city} />
          : tab === "routes" ? <SavedRoutes city={city} />
          : <SavedCollections />}
      </div>
    </div>
  );
}
