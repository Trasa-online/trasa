import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCity } from "@/hooks/useActiveCity";
import CreateHeader from "@/components/create/CreateHeader";
import JournalTab from "@/components/home/JournalTab";
import { MyCollections } from "@/pages/Explore";

// Zakladka "Robocze" huba tworzenia (/utworz/robocze): twoje niedokonczone / utworzone
// TRASY (JournalTab) i LISTY (MyCollections, w tym pending). Trasy|Listy = wspolny toggle
// z naglowka (CreateHeader). Reuse istniejacych komponentow - zero nowej logiki.
export default function CreateDrafts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [city] = useActiveCity();
  const [mode, setMode] = useState<"trasy" | "listy">("trasy");
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/eksploruj"));

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <CreateHeader active="robocze" mode={mode} onMode={setMode} onBack={back} />
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {mode === "trasy"
          ? (user ? <JournalTab userId={user.id} city={city} /> : <p className="py-16 text-center text-sm text-muted-foreground">Zaloguj się, żeby zobaczyć swoje trasy.</p>)
          : <MyCollections />}
      </div>
    </div>
  );
}
