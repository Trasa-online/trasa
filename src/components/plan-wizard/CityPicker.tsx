import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CITIES = ["Kraków", "Budapeszt", "Warszawa", "Wrocław", "Poznań", "Gdańsk"];
const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

interface CityPickerProps {
  onConfirm: (city: string) => void;
}

const CityPicker = ({ onConfirm }: CityPickerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyCity, setNotifyCity] = useState("");
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to initial position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = selectedIndex * ITEM_HEIGHT;
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const clamped = Math.max(0, Math.min(CITIES.length - 1, Math.round(rawIndex)));
    setSelectedIndex(clamped);

    // Snap after scroll settles
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 80);
  };

  const getTextClass = (distance: number) => {
    if (distance === 0) return "text-5xl font-black text-foreground";
    if (distance === 1) return "text-[2rem] font-semibold text-foreground/60";
    if (distance === 2) return "text-2xl font-medium text-foreground/30";
    return "text-xl font-normal text-foreground/15";
  };

  const handleNotify = () => {
    if (!notifyCity.trim()) {
      toast.error("Wpisz nazwę miasta");
      return;
    }
    if (!notifyEmail.includes("@")) {
      toast.error("Podaj prawidłowy adres email");
      return;
    }
    toast.success(`Dzięki! Gdy ${notifyCity} będzie dostępne, damy Ci znać.`);
    setNotifyCity("");
    setNotifyEmail("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Drum picker */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full" style={{ height: CONTAINER_HEIGHT }}>
          {/* Center highlight line */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: PADDING,
              height: ITEM_HEIGHT,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0.03) 60%, transparent)",
            }}
          />

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-scroll"
            style={{
              scrollSnapType: "y mandatory",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {/* Top padding */}
            <div style={{ height: PADDING }} />

            {CITIES.map((city, i) => {
              const distance = Math.abs(i - selectedIndex);
              return (
                <div
                  key={city}
                  onClick={() => {
                    setSelectedIndex(i);
                    scrollRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
                  }}
                  className={cn(
                    "flex items-center justify-center cursor-pointer transition-all duration-150 select-none",
                    getTextClass(distance)
                  )}
                  style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                >
                  {city}
                </div>
              );
            })}

            {/* Bottom padding */}
            <div style={{ height: PADDING }} />
          </div>
        </div>
      </div>

      {/* "Not your city?" banner */}
      <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-background border border-border space-y-2 shadow-sm">
        <p className="text-xs font-semibold text-foreground">
          Nie widzisz swojego miasta?
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Nazwa miasta"
            value={notifyCity}
            onChange={(e) => setNotifyCity(e.target.value)}
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleNotify()}
          />
          <Input
            type="email"
            placeholder="Twój email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleNotify()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleNotify}
            className="h-8 text-xs px-3 shrink-0"
          >
            Wyślij
          </Button>
        </div>
        <p className="text-[10px] text-foreground/60 leading-relaxed">
          Podając email zgadzasz się na jednorazowe powiadomienie, gdy Twoje miasto pojawi się w aplikacji. Nie wysyłamy spamu.
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe-4 pb-6">
        <Button
          onClick={() => onConfirm(CITIES[selectedIndex])}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20"
        >
          Dalej
        </Button>
      </div>
    </div>
  );
};

export default CityPicker;
