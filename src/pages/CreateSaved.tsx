import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveCity } from "@/hooks/useActiveCity";
import CitySelect from "@/components/home/CitySelect";
import CreateHeader from "@/components/create/CreateHeader";
import { SavedRoutes, SavedCollections } from "@/components/home/DiscoveryFeed";

// Zakladka "Zapisane" huba tworzenia (/utworz/zapisane): zapisane TRASY (SavedRoutes) i
// LISTY (SavedCollections) od innych - do ponownego uzycia przy tworzeniu. Trasy|Listy =
// wspolny toggle z naglowka (CreateHeader).
export default function CreateSaved() {
  const navigate = useNavigate();
  const [city, setCity] = useActiveCity();
  const [mode, setMode] = useState<"trasy" | "listy">("trasy");
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/eksploruj"));

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <CreateHeader active="zapisane" mode={mode} onMode={setMode} onBack={back} />
      <div className="px-4 pt-3">
        <CitySelect city={city} onCityChange={setCity} allowAll />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {mode === "trasy" ? <SavedRoutes city={city} /> : <SavedCollections />}
      </div>
    </div>
  );
}
