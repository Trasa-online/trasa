import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CITY_NEIGHBORHOODS: Record<string, string[]> = {
  "Kraków":    ["Stare Miasto", "Kazimierz", "Podgórze", "Zabłocie", "Krowodrza", "Dębniki", "Nowa Huta", "Bronowice"],
  "Gdańsk":    ["Główne Miasto", "Stare Miasto", "Wrzeszcz", "Oliwa", "Zaspa", "Śródmieście", "Młode Miasto"],
  "Warszawa":  ["Śródmieście", "Praga-Północ", "Praga-Południe", "Mokotów", "Żoliborz", "Wola", "Ursynów", "Wilanów"],
  "Wrocław":   ["Stare Miasto", "Nadodrze", "Śródmieście", "Krzyki", "Fabryczna", "Psie Pole"],
  "Poznań":    ["Stare Miasto", "Jeżyce", "Łazarz", "Wilda", "Grunwald", "Nowe Miasto"],
  "Zakopane":  ["Centrum", "Krupówki", "Gubałówka", "Cyrhla", "Pardałówka"],
};

interface StartingLocationPickerProps {
  city: string;
  onConfirm: (location: string) => void;
  onSkip: () => void;
}

const StartingLocationPicker = ({ city, onConfirm, onSkip }: StartingLocationPickerProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const neighborhoods = CITY_NEIGHBORHOODS[city] ?? [];

  return (
    <div className="flex flex-col h-full px-5">
      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="space-y-2">
          <p className="text-3xl font-black leading-tight">
            Skąd wyruszasz<br />w {city}?
          </p>
          <p className="text-sm text-muted-foreground">
            Dobierzemy miejsca blisko Twojej okolicy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {neighborhoods.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n === selected ? null : n)}
              className={cn(
                "px-4 py-2.5 rounded-full text-sm font-medium border transition-all active:scale-95",
                selected === n
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:border-foreground/40"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-safe-4 pb-6 space-y-3">
        <Button
          size="lg"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20 disabled:opacity-40"
        >
          Dalej
        </Button>
        <button
          onClick={onSkip}
          className="w-full text-sm text-muted-foreground py-2 active:opacity-60 transition-opacity"
        >
          Pomiń
        </button>
      </div>
    </div>
  );
};

export default StartingLocationPicker;
