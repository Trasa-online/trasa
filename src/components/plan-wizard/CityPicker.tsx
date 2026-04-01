import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

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
      { name: "Łódź",       comingSoon: true },
      { name: "Poznań",     comingSoon: true },
      { name: "Trójmiasto", comingSoon: true },
      { name: "Warszawa",   comingSoon: true },
      { name: "Wrocław",    comingSoon: true },
    ],
  },
  {
    code: "HU", flag: "🇭🇺", name: "Węgry",
    cities: [{ name: "Budapeszt" }],
  },
  {
    code: "MT", flag: "🇲🇹", name: "Malta",
    cities: [{ name: "Valletta" }],
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

// ── Drum constants ─────────────────────────────────────────────────────────

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

interface CityPickerProps {
  onConfirm: (city: string) => void;
}

const CityPicker = ({ onConfirm }: CityPickerProps) => {
  const [step, setStep] = useState<"country" | "city">("country");
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(0);

  const countryScrollRef = useRef<HTMLDivElement>(null);
  const cityScrollRef = useRef<HTMLDivElement>(null);
  const [cityIndex, setCityIndex] = useState(0);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyCity, setNotifyCity] = useState("");
  const countryScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCountry = COUNTRIES[selectedCountryIndex];
  const cities = selectedCountry.cities;
  const selectedCity = cities[cityIndex];
  const isCityComingSoon = !!selectedCity?.comingSoon;
  const isCountryComingSoon = !!selectedCountry?.comingSoon;

  // Reset city drum when country changes
  useEffect(() => {
    setCityIndex(0);
    setTimeout(() => {
      cityScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }, [selectedCountryIndex]);

  useEffect(() => {
    if (countryScrollRef.current) countryScrollRef.current.scrollTop = 0;
  }, []);

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

  const handleCountryScroll = () => {
    const el = countryScrollRef.current;
    if (!el) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const clamped = Math.max(0, Math.min(COUNTRIES.length - 1, Math.round(rawIndex)));
    setSelectedCountryIndex(clamped);
    if (countryScrollTimeout.current) clearTimeout(countryScrollTimeout.current);
    countryScrollTimeout.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 80);
  };

  const handleCityScroll = () => {
    const el = cityScrollRef.current;
    if (!el) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const clamped = Math.max(0, Math.min(cities.length - 1, Math.round(rawIndex)));
    setCityIndex(clamped);
    if (cityScrollTimeout.current) clearTimeout(cityScrollTimeout.current);
    cityScrollTimeout.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 80);
  };

  const handleNotify = () => {
    if (!notifyCity.trim()) { toast.error("Wpisz nazwę miasta"); return; }
    if (!notifyEmail.includes("@")) { toast.error("Podaj prawidłowy adres email"); return; }
    toast.success(`Dzięki! Gdy ${notifyCity} będzie dostępne, damy Ci znać.`);
    setNotifyCity(""); setNotifyEmail("");
  };

  const handleCountryNext = () => {
    if (isCountryComingSoon) return;
    setStep("city");
  };

  const handleBackToCountry = () => {
    setStep("country");
    setCityIndex(0);
  };

  return (
    <div className="flex flex-col h-full">

      {/* Step 2 header: back arrow + country label */}
      {step === "city" && (
        <div className="flex items-center gap-3 px-5 pt-4 pb-1">
          <button
            onClick={handleBackToCountry}
            className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground/70">
            {selectedCountry.flag} {selectedCountry.name}
          </span>
        </div>
      )}

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

          {/* Country drum */}
          {step === "country" && (
            <div
              ref={countryScrollRef}
              onScroll={handleCountryScroll}
              className="absolute inset-0 overflow-y-scroll"
              style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div style={{ height: PADDING }} />
              {COUNTRIES.map((country, i) => {
                const distance = Math.abs(i - selectedCountryIndex);
                return (
                  <div
                    key={country.code}
                    onClick={() => {
                      if (country.comingSoon) return;
                      setSelectedCountryIndex(i);
                      countryScrollRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-3 transition-all duration-150 select-none",
                      country.comingSoon ? "cursor-default" : "cursor-pointer",
                      getTextClass(distance, country.comingSoon)
                    )}
                    style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                  >
                    <span>{country.flag}</span>
                    <span>{country.name}</span>
                  </div>
                );
              })}
              <div style={{ height: PADDING }} />
            </div>
          )}

          {/* City drum */}
          {step === "city" && (
            <div
              ref={cityScrollRef}
              onScroll={handleCityScroll}
              className="absolute inset-0 overflow-y-scroll"
              style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div style={{ height: PADDING }} />
              {cities.map((city, i) => {
                const distance = Math.abs(i - cityIndex);
                return (
                  <div
                    key={city.name}
                    onClick={() => { setCityIndex(i); cityScrollRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" }); }}
                    className={cn("flex items-center justify-center cursor-pointer transition-all duration-150 select-none", getTextClass(distance, city.comingSoon))}
                    style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                  >
                    {city.name}
                  </div>
                );
              })}
              <div style={{ height: PADDING }} />
            </div>
          )}
        </div>
      </div>

      {/* "Not your city?" banner */}
      <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-background border border-border space-y-2 shadow-sm">
        <p className="text-xs font-semibold text-foreground">Nie widzisz swojego miasta?</p>
        <div className="flex gap-2">
          <Input type="text" placeholder="Nazwa miasta" value={notifyCity} onChange={e => setNotifyCity(e.target.value)} className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && handleNotify()} />
          <Input type="email" placeholder="Twój email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && handleNotify()} />
          <Button size="sm" variant="outline" onClick={handleNotify} className="h-8 text-xs px-3 shrink-0">Wyślij</Button>
        </div>
        <p className="text-[10px] text-foreground/60 leading-relaxed">
          Podając email zgadzasz się na jednorazowe powiadomienie, gdy Twoje miasto pojawi się w aplikacji. Nie wysyłamy spamu.
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe-4 pb-6">
        <Button
          onClick={() => {
            if (step === "country") {
              handleCountryNext();
            } else {
              if (!isCityComingSoon) onConfirm(selectedCity.name);
            }
          }}
          disabled={step === "country" ? isCountryComingSoon : isCityComingSoon}
          size="lg"
          className={cn(
            "w-full rounded-full text-base font-semibold border-0 shadow-lg",
            (step === "country" ? isCountryComingSoon : isCityComingSoon)
              ? "bg-muted text-muted-foreground shadow-none cursor-default"
              : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
          )}
        >
          {step === "country"
            ? (isCountryComingSoon ? "Wkrótce dostępne" : "Dalej")
            : (isCityComingSoon ? "Wkrótce dostępne" : "Dalej")}
        </Button>
      </div>
    </div>
  );
};

export default CityPicker;
