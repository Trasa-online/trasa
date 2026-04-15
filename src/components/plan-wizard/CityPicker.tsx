import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Country / city data ────────────────────────────────────────────────────

type City = { name: string; comingSoon?: boolean };

type Country = {
  code: string;
  flag: string;
  name: string;
  comingSoon?: boolean;
  cities: City[];
};

const COUNTRIES: Country[] = [
  {
    code: "PL", flag: "🇵🇱", name: "Polska",
    cities: [
      { name: "Kraków" },
      { name: "Łódź" },
      { name: "Warszawa" },
      { name: "Gdańsk",       comingSoon: true },
      { name: "Wrocław",      comingSoon: true },
      { name: "Poznań",       comingSoon: true },
      { name: "Katowice",     comingSoon: true },
      { name: "Szczecin",     comingSoon: true },
      { name: "Lublin",       comingSoon: true },
      { name: "Trójmiasto",   comingSoon: true },
      { name: "Toruń",        comingSoon: true },
      { name: "Zakopane",     comingSoon: true },
    ],
  },
  {
    code: "IT", flag: "🇮🇹", name: "Włochy", comingSoon: true,
    cities: [{ name: "Rzym", comingSoon: true }, { name: "Mediolan", comingSoon: true }, { name: "Florencja", comingSoon: true }],
  },
  {
    code: "ES", flag: "🇪🇸", name: "Hiszpania", comingSoon: true,
    cities: [{ name: "Barcelona", comingSoon: true }, { name: "Madryt", comingSoon: true }],
  },
  {
    code: "FR", flag: "🇫🇷", name: "Francja", comingSoon: true,
    cities: [{ name: "Paryż", comingSoon: true }, { name: "Lyon", comingSoon: true }],
  },
  {
    code: "DE", flag: "🇩🇪", name: "Niemcy", comingSoon: true,
    cities: [{ name: "Berlin", comingSoon: true }, { name: "Monachium", comingSoon: true }],
  },
  {
    code: "PT", flag: "🇵🇹", name: "Portugalia", comingSoon: true,
    cities: [{ name: "Lizbona", comingSoon: true }, { name: "Porto", comingSoon: true }],
  },
  {
    code: "HR", flag: "🇭🇷", name: "Chorwacja", comingSoon: true,
    cities: [{ name: "Dubrownik", comingSoon: true }, { name: "Split", comingSoon: true }],
  },
  {
    code: "GR", flag: "🇬🇷", name: "Grecja", comingSoon: true,
    cities: [{ name: "Ateny", comingSoon: true }, { name: "Saloniki", comingSoon: true }],
  },
  {
    code: "AT", flag: "🇦🇹", name: "Austria", comingSoon: true,
    cities: [{ name: "Wiedeń", comingSoon: true }],
  },
  {
    code: "CZ", flag: "🇨🇿", name: "Czechy", comingSoon: true,
    cities: [{ name: "Praga", comingSoon: true }],
  },
  {
    code: "HU", flag: "🇭🇺", name: "Węgry", comingSoon: true,
    cities: [{ name: "Budapeszt", comingSoon: true }],
  },
  {
    code: "NL", flag: "🇳🇱", name: "Holandia", comingSoon: true,
    cities: [{ name: "Amsterdam", comingSoon: true }],
  },
  {
    code: "MT", flag: "🇲🇹", name: "Malta", comingSoon: true,
    cities: [{ name: "Valletta", comingSoon: true }],
  },
];

type ActiveCountryCode = "PL";

// ── Drum constants ─────────────────────────────────────────────────────────

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

interface CityPickerProps {
  onConfirm: (city: string) => void;
}

const CityPicker = ({ onConfirm }: CityPickerProps) => {
  const [countryCode, setCountryCode] = useState<ActiveCountryCode>("PL");

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode)!;
  const cities = selectedCountry.cities;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifyCity, setNotifyCity] = useState("");
  const { user } = useAuth();
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset drum when country changes
  useEffect(() => {
    setSelectedIndex(0);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }, [countryCode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const clamped = Math.max(0, Math.min(cities.length - 1, Math.round(rawIndex)));
    setSelectedIndex(clamped);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 80);
  };

  const getTextClass = (distance: number, comingSoon?: boolean) => {
    if (comingSoon) {
      if (distance === 0) return "text-5xl font-black text-foreground/25";
      if (distance === 1) return "text-[2rem] font-semibold text-foreground/15";
      if (distance === 2) return "text-2xl font-medium text-foreground/10";
      return "text-xl font-normal text-foreground/[0.06]";
    }
    if (distance === 0) return "text-5xl font-black text-foreground";
    if (distance === 1) return "text-[2rem] font-semibold text-foreground/60";
    if (distance === 2) return "text-2xl font-medium text-foreground/30";
    return "text-xl font-normal text-foreground/15";
  };

  const selectedCity = cities[selectedIndex];
  const isComingSoon = !!selectedCity?.comingSoon;

  const handleNotify = async () => {
    if (!notifyCity.trim()) { toast.error("Wpisz nazwę miasta"); return; }
    const { error } = await (supabase as any).from("city_requests").insert({ user_id: user?.id ?? null, city_name: notifyCity.trim() });
    if (error) { toast.error("Nie udało się wysłać zgłoszenia"); return; }
    toast.success(`Dzięki! Gdy ${notifyCity} będzie dostępne, damy Ci znać.`);
    setNotifyCity("");
  };

  return (
    <div className="flex flex-col h-full">

      {/* Country selector — horizontal scrollable pills */}
      <div className="pt-4 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-5 mb-2">Kraj</p>
        <div
          className="flex gap-2 overflow-x-auto pl-5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {COUNTRIES.map(country => {
            const isActive = !country.comingSoon;
            const isSelected = country.code === countryCode;
            return (
              <button
                key={country.code}
                onClick={() => isActive && setCountryCode(country.code as ActiveCountryCode)}
                disabled={!isActive}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors",
                  isSelected
                    ? "bg-foreground text-background"
                    : isActive
                      ? "bg-card border border-border/50 text-foreground active:bg-muted"
                      : "bg-card border border-border/30 text-foreground/30"
                )}
              >
                <span className="text-base leading-none">{country.flag}</span>
                <span>{country.name}</span>
                {!isActive && (
                  <span className="text-[9px] font-bold tracking-wide text-muted-foreground/50 bg-muted/80 px-1.5 py-0.5 rounded-full">wkrótce</span>
                )}
              </button>
            );
          })}
          {/* Right padding spacer so last pill isn't flush with edge */}
          <div className="w-5 shrink-0" />
        </div>
      </div>

      {/* Drum picker */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full" style={{ height: CONTAINER_HEIGHT }}>
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
            style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div style={{ height: PADDING }} />
            {cities.map((city, i) => {
              const distance = Math.abs(i - selectedIndex);
              return (
                <div
                  key={city.name}
                  onClick={() => { setSelectedIndex(i); scrollRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" }); }}
                  className={cn("flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 select-none", getTextClass(distance, city.comingSoon))}
                  style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                >
                  {city.name}
                  {city.comingSoon && distance <= 1 && (
                    <Lock className={cn("shrink-0", distance === 0 ? "h-5 w-5" : "h-4 w-4")} />
                  )}
                </div>
              );
            })}
            <div style={{ height: PADDING }} />
          </div>
        </div>
      </div>

      {/* "Not your city?" banner */}
      <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-background border border-border space-y-2 shadow-sm">
        <p className="text-xs font-semibold text-foreground">Nie widzisz swojego miasta?</p>
        <div className="flex gap-2">
          <Input type="text" placeholder="Wpisz nazwę miasta" value={notifyCity} onChange={e => setNotifyCity(e.target.value)} className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && handleNotify()} />
          <Button size="sm" variant="outline" onClick={handleNotify} className="h-8 text-xs px-3 shrink-0">Wyślij</Button>
        </div>
        <p className="text-[10px] text-foreground/60 leading-relaxed">
          Damy Ci znać, gdy Twoje miasto pojawi się w aplikacji.
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe-4 pb-6">
        <Button
          onClick={() => !isComingSoon && onConfirm(selectedCity.name)}
          disabled={isComingSoon}
          size="lg"
          className={cn(
            "w-full rounded-full text-base font-semibold border-0 shadow-lg",
            isComingSoon
              ? "bg-muted text-muted-foreground shadow-none cursor-default"
              : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
          )}
        >
          {isComingSoon ? `${selectedCity?.name} — wkrótce` : `Dalej — ${selectedCity?.name}`}
        </Button>
      </div>
    </div>
  );
};

export default CityPicker;
