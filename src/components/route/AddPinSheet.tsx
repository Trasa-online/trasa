import { useState, useEffect } from "react";
import { Search, Loader2, MapPin, Plus, Heart, Tag, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { PlanPin } from "./DayPinList";

interface AddPinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinAdd: (pin: PlanPin) => void;
  cityContext: string;
  likedPlaces?: string[];
  existingPinNames?: string[];
}

type Tab = "liked" | "search" | "category" | "manual";

interface DbPlace {
  id: string;
  place_name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  rating?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum",
  park: "Park", bar: "Bar", club: "Klub", monument: "Zabytek",
  gallery: "Galeria", market: "Targ", viewpoint: "Widok",
  shopping: "Zakupy", experience: "Rozrywka", walk: "Spacer",
  nightlife: "Nocne życie", church: "Kościół",
};

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🔭", shopping: "🛍️", experience: "🎪",
  walk: "🚶", nightlife: "🎶", church: "⛪",
};

const MANUAL_CATEGORIES = [
  "restaurant", "cafe", "bar", "museum", "park", "monument",
  "gallery", "viewpoint", "shopping", "market", "walk", "experience",
];

function dbPlaceToPin(p: DbPlace): PlanPin {
  return {
    place_name: p.place_name,
    address: p.address ?? "",
    description: p.description ?? "",
    suggested_time: "00:00",
    category: p.category,
    latitude: p.latitude,
    longitude: p.longitude,
    day_number: 0,
  };
}

const AddPinSheet = ({ open, onOpenChange, onPinAdd, cityContext, likedPlaces = [], existingPinNames = [] }: AddPinSheetProps) => {
  const existingSet = new Set(existingPinNames.map(n => n.toLowerCase()));
  const availableLiked = likedPlaces.filter(n => !existingSet.has(n.toLowerCase()));

  const defaultTab: Tab = availableLiked.length > 0 ? "liked" : "search";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DbPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [allCityPlaces, setAllCityPlaces] = useState<DbPlace[]>([]);
  const [loadingCity, setLoadingCity] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addingName, setAddingName] = useState<string | null>(null);

  // Manual form state
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<string>("restaurant");
  const [manualTime, setManualTime] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  // Fetch all places for city (for category browse + liked lookup)
  useEffect(() => {
    if (!open || !cityContext) return;
    setLoadingCity(true);
    (supabase as any)
      .from("places")
      .select("id, place_name, category, address, latitude, longitude, description, rating")
      .ilike("city", cityContext)
      .eq("is_active", true)
      .then(({ data }: { data: DbPlace[] | null }) => {
        setAllCityPlaces(data ?? []);
        setLoadingCity(false);
      });
  }, [open, cityContext]);

  // Search in places table
  useEffect(() => {
    if (tab !== "search" || query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, category, address, latitude, longitude, description, rating")
        .ilike("city", cityContext)
        .ilike("place_name", `%${query}%`)
        .eq("is_active", true)
        .limit(10);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tab, cityContext]);

  const handleClose = () => {
    setQuery("");
    setSearchResults([]);
    setSelectedCategory(null);
    setManualName("");
    setManualCategory("restaurant");
    setManualTime("");
    setManualAddress("");
    onOpenChange(false);
  };

  const handleAddDbPlace = (place: DbPlace) => {
    onPinAdd(dbPlaceToPin(place));
    handleClose();
  };

  const handleAddLikedByName = async (name: string) => {
    setAddingName(name);
    const match = allCityPlaces.find(p => p.place_name.toLowerCase() === name.toLowerCase());
    if (match) {
      onPinAdd(dbPlaceToPin(match));
    } else {
      onPinAdd({
        place_name: name,
        address: "",
        description: "",
        suggested_time: "00:00",
        category: "viewpoint",
        latitude: 0,
        longitude: 0,
        day_number: 0,
      });
    }
    setAddingName(null);
    handleClose();
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    onPinAdd({
      place_name: manualName.trim(),
      address: manualAddress.trim(),
      description: "",
      suggested_time: manualTime || "00:00",
      category: manualCategory,
      latitude: 0,
      longitude: 0,
      day_number: 0,
    });
    handleClose();
  };

  const switchToManualWithQuery = () => {
    setManualName(query);
    setTab("manual");
  };

  const categories = [...new Set(allCityPlaces.map(p => p.category))].sort();
  const categoryPlaces = selectedCategory
    ? allCityPlaces.filter(p => p.category === selectedCategory && !existingSet.has(p.place_name.toLowerCase()))
    : [];

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "liked", label: "Wybrane", icon: <Heart className="h-3.5 w-3.5" />, count: availableLiked.length },
    { id: "search", label: "Szukaj", icon: <Search className="h-3.5 w-3.5" /> },
    { id: "category", label: "Kategorie", icon: <Tag className="h-3.5 w-3.5" /> },
    { id: "manual", label: "Własne", icon: <PenLine className="h-3.5 w-3.5" /> },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="text-left pb-2 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Dodaj punkt
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 flex-shrink-0 overflow-x-auto pb-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn(
                  "h-4 min-w-[16px] px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  tab === t.id ? "bg-background/20 text-background" : "bg-orange-500 text-white"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Liked tab ── */}
          {tab === "liked" && (
            <div className="space-y-1.5">
              {availableLiked.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {likedPlaces.length === 0
                    ? "Nie wybrałeś żadnych miejsc podczas przeglądania"
                    : "Wszystkie wybrane miejsca są już w planie"}
                </div>
              ) : (
                availableLiked.map(name => {
                  const dbPlace = allCityPlaces.find(p => p.place_name.toLowerCase() === name.toLowerCase());
                  return (
                    <button
                      key={name}
                      onClick={() => handleAddLikedByName(name)}
                      disabled={addingName === name}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-orange-500/10 flex items-center justify-center text-lg">
                        {CATEGORY_EMOJI[dbPlace?.category ?? ""] ?? "📍"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                        {dbPlace && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {CATEGORY_LABELS[dbPlace.category] ?? dbPlace.category}
                          </p>
                        )}
                      </div>
                      {addingName === name
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                        : <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      }
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ── Search tab ── */}
          {tab === "search" && (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={cityContext ? `Szukaj w ${cityContext}…` : "Szukaj miejsca…"}
                  autoFocus
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
                />
              </div>
              {searching && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && query.length >= 2 && searchResults.length === 0 && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <p className="text-sm text-muted-foreground">Brak wyników dla „{query}"</p>
                  <button
                    onClick={switchToManualWithQuery}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold active:scale-[0.97] transition-transform"
                  >
                    <PenLine className="h-4 w-4" />
                    Dodaj „{query}" ręcznie
                  </button>
                </div>
              )}
              {!searching && searchResults.length > 0 && (
                <div className="space-y-1.5">
                  {searchResults.map(place => (
                    <button
                      key={place.id}
                      onClick={() => handleAddDbPlace(place)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl bg-muted/40 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-lg">
                        {CATEGORY_EMOJI[place.category] ?? "📍"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{place.place_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {CATEGORY_LABELS[place.category] ?? place.category}
                          {place.rating ? ` · ⭐ ${place.rating}` : ""}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              )}
              {!searching && query.length < 2 && (
                <p className="text-center py-8 text-sm text-muted-foreground">Wpisz nazwę miejsca, aby wyszukać</p>
              )}
            </>
          )}

          {/* ── Category tab ── */}
          {tab === "category" && (
            <>
              {loadingCity ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                          selectedCategory === cat
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {CATEGORY_EMOJI[cat] ?? "📍"} {CATEGORY_LABELS[cat] ?? cat}
                      </button>
                    ))}
                  </div>

                  {selectedCategory && (
                    <div className="space-y-1.5">
                      {categoryPlaces.length === 0 ? (
                        <p className="text-center py-6 text-sm text-muted-foreground">Wszystkie miejsca z tej kategorii są już w planie</p>
                      ) : (
                        categoryPlaces.map(place => (
                          <button
                            key={place.id}
                            onClick={() => handleAddDbPlace(place)}
                            className="w-full flex items-start gap-3 p-3 rounded-xl bg-muted/40 active:scale-[0.98] transition-all text-left"
                          >
                            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{place.place_name}</p>
                              {place.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{place.description}</p>
                              )}
                              {place.rating && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">⭐ {place.rating}</p>
                              )}
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {!selectedCategory && (
                    <p className="text-center py-8 text-sm text-muted-foreground">Wybierz kategorię powyżej</p>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Manual tab ── */}
          {tab === "manual" && (
            <div className="space-y-4 pb-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Nazwa miejsca
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="np. Kawiarnia u Marii"
                  autoFocus={tab === "manual"}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Kategoria
                </label>
                <div className="flex flex-wrap gap-2">
                  {MANUAL_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setManualCategory(cat)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors",
                        manualCategory === cat
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address (optional) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Adres <span className="font-normal normal-case">(opcjonalnie)</span>
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  placeholder="np. ul. Floriańska 5, Kraków"
                  className="w-full h-11 px-3 rounded-xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
                />
              </div>

              {/* Suggested time (optional) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Godzina <span className="font-normal normal-case">(opcjonalnie)</span>
                </label>
                <input
                  type="time"
                  value={manualTime}
                  onChange={e => setManualTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:border-foreground/30"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleAddManual}
                disabled={!manualName.trim()}
                className="w-full py-3.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                Dodaj do planu
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddPinSheet;
