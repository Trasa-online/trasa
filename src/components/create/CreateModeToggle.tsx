import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface CreateHandoff {
  city?: string | null;
  title?: string | null;
  // {place_name, category, address, latitude, longitude, photo_url, place_id, google_place_id?}
  places?: any[];
}

// Toggle Trasa | Lista w naglowku tworzenia (zastapil tytul "Nowy wyjazd" / "Nowa lista").
// Przelaczenie NAWIGUJE na ekran zoptymalizowany pod dany use case:
//   trasa -> /wyjazd/nowy (ComposeWyjazd: daty, zaproszenia znajomych)
//   lista -> /zestawienie/nowe (CreateRanking: notki do miejsc, opis, moderacja)
// Przenosi miasto + wybrane miejsca (+tytul), zeby nie tracic wpisanej pracy. replace=true,
// zeby przelaczanie nie mnozylo wpisow w historii (back wraca tam, skad wszedles).
export default function CreateModeToggle({ mode, getHandoff }: {
  mode: "trasa" | "lista";
  getHandoff: () => CreateHandoff;
}) {
  const navigate = useNavigate();
  const go = (target: "trasa" | "lista") => {
    if (target === mode) return;
    navigate(target === "trasa" ? "/wyjazd/nowy" : "/zestawienie/nowe", { state: getHandoff(), replace: true });
  };
  return (
    <div className="flex-1 flex justify-center">
      <div className="inline-flex items-center rounded-full bg-secondary p-0.5">
        {(["trasa", "lista"] as const).map((m) => (
          <button
            key={m}
            onClick={() => go(m)}
            className={cn(
              "px-5 h-8 rounded-full text-sm font-bold transition-colors active:scale-95",
              mode === m ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70",
            )}
          >
            {m === "trasa" ? "Trasa" : "Lista"}
          </button>
        ))}
      </div>
    </div>
  );
}
