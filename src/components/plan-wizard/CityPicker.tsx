import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Country / city data ────────────────────────────────────────────────────
// comingSoon: true = shown grayed out, not selectable
// To activate: set comingSoon: false (or remove the flag)

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
      { name: "Poznań",     comingSoon: true },
      { name: "Trójmiasto", comingSoon: true },
      { name: "Warszawa" },
      { name: "Wrocław",    comingSoon: true },
    ],
  },
  {
    code: "HU", flag: "🇭🇺", name: "Węgry", comingSoon: true,
    cities: [{ name: "Budapeszt", comingSoon: true }],
  },
  {
    code: "MT", flag: "🇲🇹", name: "Malta", comingSoon: true,
    cities: [{ name: "Valletta", comingSoon: true }],
  },
  {
    code: "ES", flag: "🇪🇸", name: "Hiszpania", comingSoon: true,
    cities: [{ name: "Barcelona", comingSoon: true }],
  },
  {
    code: "PT", flag: "🇵🇹", name: "Portugalia", comingSoon: true,
    cities: [{ name: "Lizbona", comingSoon: true }],
  },
  {
    code: "IT", flag: "🇮🇹", name: "Włochy", comingSoon: true,
    cities: [{ name: "Rzym", comingSoon: true }],
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
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);

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

      {/* Country selector */}
      <div className="flex justify-center pt-5 pb-1 relative">
        <button
          onClick={() => setCountryMenuOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm text-sm font-semibold transition-colors active:bg-muted"
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span>{selectedCountry.name}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", countryMenuOpen && "rotate-180")} />
        </button>

        {/* Dropdown */}
        {countryMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setCountryMenuOpen(false)} />
            <div className="absolute top-full mt-2 z-20 bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden min-w-[200px]">
              {COUNTRIES.map(country => {
                const isActive = !country.comingSoon;
                return isActive ? (
                  <button
                    key={country.code}
                    onClick={() => { setCountryCode(country.code as ActiveCountryCode); setCountryMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-lg leading-none">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    {country.code === countryCode && <Check className="h-4 w-4 text-orange-600" />}
                  </button>
                ) : (
                  <div
                    key={country.code}
                    className="flex items-center gap-3 px-4 py-3 text-sm opacity-35"
                  >
                    <span className="text-lg leading-none">{country.flag}</span>
                    <span className="flex-1 font-medium">{country.name}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Wkrótce</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
                  className={cn("flex items-center justify-center cursor-pointer transition-all duration-150 select-none", getTextClass(distance, city.comingSoon))}
                  style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                >
                  {city.name}
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
          {isComingSoon ? "Wkrótce dostępne" : "Dalej"}
        </Button>
      </div>
    </div>
  );
};

export default CityPicker;
