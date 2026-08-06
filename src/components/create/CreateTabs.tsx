import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Zakladki huba tworzenia: Twórz | Robocze | Zapisane (2026-08-06). Wspolny pasek na gorze
// calego flow tworzenia (te same 3 zakladki, ta sama pozycja -> wrazenie jednego widoku mimo
// nawigacji). "Twórz" -> forma (trasa /wyjazd/nowy domyslnie), Robocze -> /utworz/robocze,
// Zapisane -> /utworz/zapisane.
export default function CreateTabs({ active }: { active: "tworz" | "robocze" | "zapisane" }) {
  const navigate = useNavigate();
  const tabs = [
    { id: "tworz", label: "Twórz", to: "/utworz" },
    { id: "robocze", label: "Robocze", to: "/utworz/robocze" },
    { id: "zapisane", label: "Zapisane", to: "/utworz/zapisane" },
  ] as const;
  return (
    <div className="flex p-1 bg-secondary rounded-full">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => { if (t.id !== active) navigate(t.to); }}
          className={cn(
            "flex-1 h-9 rounded-full text-sm font-bold transition-colors active:scale-[0.98]",
            active === t.id ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
