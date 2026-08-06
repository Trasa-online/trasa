import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCity } from "@/hooks/useActiveCity";
import CreateTabs from "@/components/create/CreateTabs";
import JournalTab from "@/components/home/JournalTab";
import { MyCollections } from "@/pages/Explore";
import { cn } from "@/lib/utils";

// Zakladka "Robocze" huba tworzenia (/utworz/robocze): twoje niedokonczone / utworzone
// TRASY (JournalTab - ma pigulki Robocze|Wspomnienia) i LISTY (MyCollections, w tym pending).
// Sub-toggle Trasa|Lista spojny z widokiem Twórz. Reuse istniejacych komponentow - zero nowej logiki.
export default function CreateDrafts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [city] = useActiveCity();
  const [sub, setSub] = useState<"trasa" | "lista">("trasa");
  const close = () => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={close} aria-label="Zamknij" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1"><CreateTabs active="robocze" /></div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {/* Sub-toggle Trasa | Lista (spojny z Twórz) */}
        <div className="flex p-1 bg-secondary rounded-full mb-3">
          {([{ id: "trasa", label: "Trasy" }, { id: "lista", label: "Listy" }] as { id: "trasa" | "lista"; label: string }[]).map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={cn("flex-1 h-9 rounded-full text-sm font-bold transition-colors active:scale-[0.98]",
                sub === s.id ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70")}
            >
              {s.label}
            </button>
          ))}
        </div>

        {sub === "trasa"
          ? (user ? <JournalTab userId={user.id} city={city} /> : <p className="py-16 text-center text-sm text-muted-foreground">Zaloguj się, żeby zobaczyć swoje trasy.</p>)
          : <MyCollections />}
      </div>
    </div>
  );
}
