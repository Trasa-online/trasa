import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

// EN display names for cities/countries. Canonical PL `name` in COUNTRIES stays
// intact (used for DB queries / expandCity) - these maps are display-only.
const CITY_EN: Record<string, string> = {
  "Warszawa": "Warsaw", "Gdańsk": "Gdansk", "Sopot": "Sopot", "Gdynia": "Gdynia",
  "Trójmiasto": "Tricity", "Kraków": "Krakow", "Łódź": "Lodz", "Poznań": "Poznan",
  "Wrocław": "Wroclaw", "Budapeszt": "Budapest", "Valletta": "Valletta",
  "Barcelona": "Barcelona", "Lizbona": "Lisbon", "Rzym": "Rome",
};
const COUNTRY_EN: Record<string, string> = {
  "Polska": "Poland", "Węgry": "Hungary", "Malta": "Malta",
  "Hiszpania": "Spain", "Portugalia": "Portugal", "Włochy": "Italy",
};

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
      // Etap 1 (Warszawa) - cache zdjęć działa tylko dla Warszawy.
      // Pozostałe miasta zablokowane do czasu rozszerzenia cache.
      { name: "Warszawa" },
      // Trójmiasto: sub-miasta osobno + "Trójmiasto" = wszystkie trzy naraz (expandCity).
      { name: "Gdańsk" },
      { name: "Sopot" },
      { name: "Gdynia" },
      { name: "Trójmiasto" },
      { name: "Wrocław" },
      { name: "Kraków",     comingSoon: true },
      { name: "Łódź",       comingSoon: true },
      { name: "Poznań",     comingSoon: true },
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

// Odblokowane miasta PL (bez comingSoon) - zrodlo prawdy dla dropdownu miast w exploreMode.
export const UNLOCKED_CITIES: string[] = (COUNTRIES.find((c) => c.code === "PL")?.cities ?? [])
  .filter((c) => !c.comingSoon)
  .map((c) => c.name);

type ActiveCountryCode = "PL";

// ── Drum constants ─────────────────────────────────────────────────────────

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 3;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

interface CityPickerProps {
  onConfirm: (city: string) => void;
}

const CityPicker = ({ onConfirm }: CityPickerProps) => {
  const { t } = useTranslation("plan");
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  const cityLabel = (name: string) => (isEn ? CITY_EN[name] ?? name : name);
  const countryLabel = (name: string) => (isEn ? COUNTRY_EN[name] ?? name : name);

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
    if (!notifyCity.trim()) { toast.error(t("city_picker.city_placeholder")); return; }
    const { error } = await (supabase as any).from("city_requests").insert({ user_id: user?.id ?? null, city_name: notifyCity.trim() });
    if (error) { toast.error(t("city_picker.send_error")); return; }
    toast.success(t("city_picker.notify_success", { city: notifyCity }));
    setNotifyCity("");
  };

  return (
    <div className="flex flex-col h-full">

      {/* Country selector */}
      <div className="flex justify-center pt-5 pb-1 relative shrink-0">
        <button
          onClick={() => setCountryMenuOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm text-sm font-semibold transition-colors active:bg-muted"
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span>{countryLabel(selectedCountry.name)}</span>
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
                    <span className="flex-1">{countryLabel(country.name)}</span>
                    {country.code === countryCode && <Check className="h-4 w-4 text-orange-600" />}
                  </button>
                ) : (
                  <div
                    key={country.code}
                    className="flex items-center gap-3 px-4 py-3 text-sm opacity-35"
                  >
                    <span className="text-lg leading-none">{country.flag}</span>
                    <span className="flex-1 font-medium">{countryLabel(country.name)}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{t("city_picker.coming_soon_badge")}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Drum picker — fills remaining space, vertically centered */}
      <div className="flex-1 flex items-center justify-center min-h-0">
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
                  className={cn("flex items-center justify-center gap-3 cursor-pointer transition-all duration-150 select-none", getTextClass(distance, city.comingSoon))}
                  style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
                >
                  <span>{cityLabel(city.name)}</span>
                  {city.comingSoon && distance <= 1 && (
                    <span className={cn(
                      "transition-all duration-150",
                      distance === 0 ? "text-2xl text-foreground/25" : "text-base text-foreground/15"
                    )}>
                      🔒
                    </span>
                  )}
                </div>
              );
            })}
            <div style={{ height: PADDING }} />
          </div>
        </div>
      </div>

      {/* "Not your city?" banner */}
      <div className="mx-5 mb-3 px-4 py-3 rounded-2xl bg-background border border-border space-y-2 shadow-sm shrink-0">
        <p className="text-xs font-semibold text-foreground">{t("city_picker.not_your_city")}</p>
        <div className="flex gap-2">
          <Input type="text" placeholder={t("city_picker.city_placeholder")} value={notifyCity} onChange={e => setNotifyCity(e.target.value)} className="h-8 text-base flex-1" onKeyDown={e => e.key === "Enter" && handleNotify()} />
          <Button size="sm" variant="outline" onClick={handleNotify} className="h-8 text-xs px-3 shrink-0">{t("city_picker.send")}</Button>
        </div>
        <p className="text-[10px] text-foreground/60 leading-relaxed">
          {t("city_picker.notify_hint")}
        </p>
      </div>

      {/* CTA */}
      <div className="px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shrink-0">
        <Button
          onClick={() => !isComingSoon && onConfirm(selectedCity.name)}
          disabled={isComingSoon}
          size="lg"
          className={cn(
            "w-full rounded-full text-base font-semibold border-0 shadow-lg",
            isComingSoon
              ? "bg-muted text-muted-foreground shadow-none cursor-default"
              : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
          )}
        >
          {isComingSoon ? t("city_picker.coming_soon_cta") : t("city_picker.next")}
        </Button>
      </div>
    </div>
  );
};

export default CityPicker;
