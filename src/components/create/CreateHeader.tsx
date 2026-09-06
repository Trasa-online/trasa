import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Naglowek widokow tworzenia. Piguly hubu Twórz|Robocze|Zapisane USUNIETE (2026-08-22, IA):
// tworzenie idzie przez arkusz "+" (CreateFlowSheet), Robocze -> profil "Wyjazdy" (badge Robocze),
// Zapisane -> profil "Zapisane". Zostaje: back + opcjonalny toggle Trasy|Listy (tryb tworzenia).
export default function CreateHeader({ mode, onMode, onBack, showMode = true }: {
  active?: "tworz" | "robocze" | "zapisane"; // ignorowany (kompatybilnosc call-site)
  mode?: "trasy" | "listy";
  onMode?: (m: "trasy" | "listy") => void;
  onBack: () => void;
  showMode?: boolean;
}) {
  const { t } = useTranslation("create-route");
  return (
    <div className="px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0 space-y-2.5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label={t("back")} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
      {/* Trasy | Listy - tryb tworzenia (tylko na formie tworzenia). */}
      {showMode && onMode && (
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
      )}
    </div>
  );
}
