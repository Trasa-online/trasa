import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Files, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

// Wspolny naglowek huba tworzenia (2026-08-07): wiersz 1 = IKONOWE zakladki Twórz|Robocze|
// Zapisane (oszczedza miejsce), wiersz 2 = pelnoszerokosciowy toggle Trasy|Listy (w tym samym
// miejscu na wszystkich widokach). Trasy|Listy znaczy roznie zaleznie od zakladki:
//   Twórz   -> tryb tworzenia (forma trasy vs listy)  [onMode nawiguje z handoffem]
//   Robocze -> twoje szkice tras vs list                [onMode = lokalny stan]
//   Zapisane-> zapisane trasy vs listy                  [onMode = lokalny stan]
export default function CreateHeader({ active, mode, onMode, onBack }: {
  active: "tworz" | "robocze" | "zapisane";
  mode: "trasy" | "listy";
  onMode: (m: "trasy" | "listy") => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const tabs = [
    { id: "tworz", label: "Twórz", icon: Plus, to: "/utworz" },
    { id: "robocze", label: "Robocze", icon: Files, to: "/utworz/robocze" },
    { id: "zapisane", label: "Zapisane", icon: Bookmark, to: "/utworz/zapisane" },
  ] as const;
  return (
    <div className="px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0 space-y-2.5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Wróć" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {/* Ikonowe zakladki - kompaktowe (ikona + mala etykieta). */}
        <div className="flex-1 flex p-1 bg-secondary rounded-2xl gap-1">
          {tabs.map((t) => {
            const on = active === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { if (!on) navigate(t.to, { replace: true }); }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors active:scale-[0.98]",
                  on ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/60",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-bold leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Trasy | Listy - pelna szerokosc, ta sama pozycja na kazdym widoku. */}
      <div className="flex p-1 bg-secondary rounded-full">
        {(["trasy", "listy"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={cn(
              "flex-1 h-9 rounded-full text-sm font-bold transition-colors active:scale-[0.98]",
              mode === m ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70",
            )}
          >
            {m === "trasy" ? "Trasy" : "Listy"}
          </button>
        ))}
      </div>
    </div>
  );
}
