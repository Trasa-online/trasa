import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StartingLocationPickerProps {
  city: string;
  onConfirm: (location: string) => void;
  onSkip: () => void;
}

const StartingLocationPicker = ({ city, onConfirm, onSkip }: StartingLocationPickerProps) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="flex flex-col h-full px-5">
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="space-y-2">
          <p className="text-3xl font-black leading-tight">
            Skąd wyruszasz<br />w {city}?
          </p>
          <p className="text-sm text-muted-foreground">
            Podaj dzielnicę lub adres — dobierzemy miejsca blisko Ciebie.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-2xl px-4 py-3">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && onConfirm(value.trim())}
            placeholder={`np. Kazimierz, Stare Miasto…`}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="pb-safe-4 pb-6 space-y-3">
        <Button
          size="lg"
          disabled={!value.trim()}
          onClick={() => onConfirm(value.trim())}
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
