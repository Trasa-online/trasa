import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPhotoUrl } from "@/lib/placePhotos";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { ArrowLeft, Lock, Copy, Check, Loader2, X, Globe, Home, Plus, BookOpen, Star, Camera } from "lucide-react";
import { SwipeCard } from "@/components/plan-wizard/PlaceSwiper";
import type { MockPlace, PlaceCategory } from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Deterministic shuffle - same city+category → same order for every user
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Interleaves places so no single category dominates — batches of 2-3 per category
function interleavedShuffle(places: any[], seed: string): any[] {
  const groups: Record<string, any[]> = {};
  for (const p of places) {
    const cat = p.category ?? "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  for (const cat of Object.keys(groups)) {
    groups[cat] = seededShuffle(groups[cat], seed + cat);
  }

  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };

  const result: any[] = [];
  let queues = Object.values(groups).map(g => [...g]);
  let qi = 0;

  while (queues.length > 0) {
    const q = queues[qi % queues.length];
    const batchSize = Math.min(Math.floor(rand() * 2) + 2, q.length); // 2 or 3
    result.push(...q.splice(0, batchSize));
    if (q.length === 0) {
      queues.splice(qi % queues.length, 1);
      if (queues.length === 0) break;
      qi = qi % queues.length;
    } else {
      qi = (qi + 1) % queues.length;
    }
  }
  return result;
}

function getDeviceId(): string {
  let id = localStorage.getItem("trasa_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("trasa_device_id", id);
  }
  return id;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

interface DemoPlace {
  id: string;
  name: string;
  photo: string;
  rating: number;
  address: string;
  tags: string[];
  description: string;
  latitude?: number;
  longitude?: number;
  category?: string;
}

type CategoryKey = "cafe" | "restaurant" | "bar" | "museum" | "park" | "experience" | "shopping" | "food" | "culture" | "attractions" | "nature";

// Maps UI category id → DB category values (covers both main and subcategory IDs)
const CATEGORY_DB_VALUES: Record<string, string[]> = {
  cafe:        ["cafe"],
  restaurant:  ["restaurant"],
  bar:         ["bar"],
  museum:      ["museum", "monument"],
  park:        ["park", "viewpoint"],
  experience:  ["experience"],
  shopping:    ["shopping", "market"],
  // Main categories from lib/categories.ts
  food:        ["restaurant", "cafe", "bar"],
  culture:     ["museum", "monument", "gallery"],
  attractions: ["experience", "market", "shopping", "club"],
  nature:      ["park", "viewpoint"],
};

const DEMO_CITIES_DATA = [
  { name: 'Warszawa',   locked: false },
  { name: 'Kraków',     locked: true  },
  { name: 'Łódź',      locked: true  },
  { name: 'Trójmiasto', locked: true  },
  { name: 'Wrocław',    locked: true  },
  { name: 'Poznań',     locked: true  },
  { name: 'Katowice',   locked: true  },
  { name: 'Szczecin',   locked: true  },
  { name: 'Lublin',     locked: true  },
  { name: 'Toruń',      locked: true  },
  { name: 'Zakopane',   locked: true  },
];
const DEMO_CITIES = DEMO_CITIES_DATA.map(c => c.name);
const DEMO_CATEGORIES = [
  { id: "cafe",       label: "Kawiarnia",   emoji: "☕"  },
  { id: "restaurant", label: "Restauracja", emoji: "🍽️" },
  { id: "bar",        label: "Bar",         emoji: "🍺"  },
  { id: "museum",     label: "Kultura",     emoji: "🏛️" },
  { id: "park",       label: "Natura",      emoji: "🌿"  },
  { id: "experience", label: "Rozrywka",    emoji: "🎪"  },
  { id: "shopping",   label: "Zakupy",      emoji: "🛍️" },
];

type Step = "city" | "location" | "mode" | "category" | "swipe" | "results" | "invite";

const DEMO_CAT_EMOJI: Record<string, string> = {
  cafe: "☕", restaurant: "🍽️", bar: "🍺", museum: "🏛️", monument: "🏛️",
  gallery: "🎨", park: "🌿", viewpoint: "🌅", experience: "🎪", shopping: "🛍️",
  market: "🛒", club: "🎶",
};

// ─── Convert DemoPlace → MockPlace ────────────────────────────────────────────

function toMock(p: DemoPlace, city: string, fallbackCategory: string): MockPlace {
  return {
    id: p.id,
    place_name: p.name,
    category: (p.category || fallbackCategory) as PlaceCategory,
    city,
    address: p.address,
    latitude: p.latitude ?? 0,
    longitude: p.longitude ?? 0,
    rating: p.rating,
    photo_url: p.photo,
    vibe_tags: p.tags,
    description: p.description,
  };
}

// ─── Real SwipeCard stack (GroupSession-style UI) ─────────────────────────────

function saveDemoLikedToStorage(liked: DemoPlace[], city: string, category: string) {
  localStorage.setItem("trasa_demo_liked", JSON.stringify({
    city,
    category,
    places: liked.map(p => ({
      place_name: p.name,
      category,
      description: p.description ?? "",
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  }));
}

const PLAN_TIERS = [
  { label: "Plan Podstawowy", badge: "bg-slate-600" },
  { label: "Plan Profesjonalny", badge: "bg-foreground" },
  { label: "Plan Premium", badge: "bg-blue-600" },
] as const;

function DemoSwiper({ places, city, category, onComplete, isBiznesDemo }: {
  places: DemoPlace[];
  city: string;
  category: string;
  onComplete: (liked: DemoPlace[]) => void;
  isBiznesDemo?: boolean;
}) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DemoPlace[]>(places);
  const [liked, setLiked] = useState<DemoPlace[]>([]);
  const [selectedForRoute, setSelectedForRoute] = useState<Set<string>>(new Set());
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "matches">("explore");
  const [showRoute, setShowRoute] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showDemoReview, setShowDemoReview] = useState(false);

  useEffect(() => {
    if (queue.length === 0 && activeTab === "explore") setActiveTab("matches");
  }, [queue.length]);

  const mockQueue = queue.map(p => toMock(p, city, category));
  const cardSlice = mockQueue.slice(0, 3);
  const swiped = places.length - queue.length;

  const handleLike = () => {
    const place = queue[0];
    setLiked(prev => [...prev, place]);
    setSelectedForRoute(prev => new Set([...prev, place.id]));
    setQueue(prev => prev.slice(1));
  };

  const handleSkip = () => setQueue(prev => prev.slice(1));

  const toggleSelection = (id: string) => {
    setSelectedForRoute(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const routePlaces = liked.filter(p => selectedForRoute.has(p.id));

  const handleCreateRoute = () => {
    const need = 3 - routePlaces.length;
    if (need > 0) {
      toast(`Zaznacz jeszcze ${need} ${need === 1 ? "miejsce" : "miejsca"}`, {
        description: "Minimum 3 miejsca potrzebne do stworzenia trasy.",
        duration: 3500,
      });
      return;
    }
    setRouteLoading(true);
    setTimeout(() => {
      setRouteLoading(false);
      setShowRoute(true);
    }, 2200);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        <button
          onClick={() => setActiveTab("explore")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${activeTab === "explore" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          Eksploruj
        </button>
        <button
          onClick={() => setActiveTab("matches")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          Dopasowania
          {liked.length > 0 && (
            <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
              {liked.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Eksploruj ── */}
      {activeTab === "explore" && (
        <>
          {/* Plan tier progress bar - biznes demo, first 3 cards */}
          {isBiznesDemo && swiped < 3 ? (
            <div className="px-4 pt-2 pb-1 shrink-0">
              <div className="flex items-center gap-2">
                {PLAN_TIERS.map((tier, i) => (
                  <div key={i} className={cn(
                    "h-1 rounded-full flex-1 transition-all duration-300",
                    i < swiped ? "bg-border/30" : i === swiped ? "bg-primary" : "bg-border/20"
                  )} />
                ))}
                <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap ml-1">
                  {PLAN_TIERS[swiped].label}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-5 py-2 text-xs text-muted-foreground shrink-0">
              Miejsce {swiped}/{places.length}
            </div>
          )}
          {queue.length > 0 ? (
            <div className="relative mx-4 mb-4" style={{ flex: "1 1 0", minHeight: 0, maxHeight: "min(680px, 78dvh)" }}>
              {cardSlice.slice().reverse().map((place, reversedIdx) => {
                const offset = cardSlice.length - 1 - reversedIdx;
                return (
                  <SwipeCard
                    key={place.id}
                    place={place}
                    city={city}
                    onLike={handleLike}
                    onSkip={handleSkip}
                    onTap={() => { setDetailPlace(place); setDetailOpen(true); }}
                    isTop={offset === 0}
                    offset={offset}
                    skipGoogleFetch={false}
                  />
                );
              })}
              {/* Plan badge on top card - biznes demo only, first 3 cards */}
              {isBiznesDemo && swiped < 3 && (
                <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-1.5">
                  <span className={cn(
                    "text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg",
                    PLAN_TIERS[swiped].badge
                  )}>
                    {PLAN_TIERS[swiped].label}
                  </span>
                  {swiped < 2 && cardSlice.length > 1 && (
                    <span className="text-white/70 text-[10px] font-medium px-1 drop-shadow-md">
                      Przesuń by zobaczyć kolejny plan
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <p className="text-5xl">✅</p>
              <p className="font-bold text-lg">Przejrzałeś wszystkie miejsca!</p>
              <p className="text-sm text-muted-foreground">Sprawdź swoje dopasowania w drugiej zakładce.</p>
              <button
                onClick={() => setActiveTab("matches")}
                className="py-3 px-6 rounded-full bg-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                Zobacz dopasowania →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Dopasowania ── */}
      {activeTab === "matches" && (
        <div className="flex-1 flex flex-col overflow-y-auto px-4 pt-4 pb-6 gap-3">
          {liked.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
              <p className="text-4xl">❤️</p>
              <p className="font-semibold">Brak polubionych miejsc</p>
              <p className="text-sm text-muted-foreground">Eksploruj miejsca i wróć tutaj</p>
              <button onClick={() => setActiveTab("explore")} className="text-sm font-semibold text-orange-600">
                Wróć do eksplorowania →
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">Zaznacz miejsca do trasy:</p>
              {liked.map((place, i) => (
                <div
                  key={place.id}
                  onClick={() => toggleSelection(place.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98]",
                    selectedForRoute.has(place.id)
                      ? "bg-card border-orange-400/50 shadow-sm"
                      : "bg-card border-border/30 opacity-55"
                  )}
                >
                  <span className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {i + 1}
                  </span>
                  <img src={place.photo} alt={place.name} className="h-12 w-12 rounded-2xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                  </div>
                  <div className={cn(
                    "shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    selectedForRoute.has(place.id) ? "border-orange-500 bg-orange-500" : "border-border/40"
                  )}>
                    {selectedForRoute.has(place.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              ))}
              <button
                onClick={handleCreateRoute}
                className={cn(
                  "w-full py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform mt-1",
                  routePlaces.length >= 3
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {routePlaces.length >= 3
                  ? `Stwórz trasę (${routePlaces.length}) →`
                  : routePlaces.length > 0
                    ? `Zaznacz jeszcze ${3 - routePlaces.length} ${3 - routePlaces.length === 1 ? "miejsce" : "miejsca"}`
                    : "Zaznacz miejsca do trasy"}
              </button>
            </>
          )}
        </div>
      )}

      <PlaceSwiperDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        place={detailPlace}
        city={city}
        onLike={() => { handleLike(); setDetailOpen(false); }}
        onSkip={() => { handleSkip(); setDetailOpen(false); }}
      />

      {/* Route loading - identical to PlanChatExperience initializing state */}
      {routeLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background animate-in fade-in duration-200">
          <style>{`
            @keyframes demoLineLoop0 {
              0%          { stroke-dashoffset: 70; opacity: 0; }
              4%          { opacity: 1; }
              25%         { stroke-dashoffset: 0; }
              83%         { stroke-dashoffset: 0; opacity: 1; }
              97%, 100%   { stroke-dashoffset: 70; opacity: 0; }
            }
            @keyframes demoLineLoop22 {
              0%, 22%     { stroke-dashoffset: 60; opacity: 0; }
              26%         { opacity: 1; }
              47%         { stroke-dashoffset: 0; }
              83%         { stroke-dashoffset: 0; opacity: 1; }
              97%, 100%   { stroke-dashoffset: 60; opacity: 0; }
            }
            @keyframes demoLineLoop44 {
              0%, 44%     { stroke-dashoffset: 60; opacity: 0; }
              48%         { opacity: 1; }
              69%         { stroke-dashoffset: 0; }
              83%         { stroke-dashoffset: 0; opacity: 1; }
              97%, 100%   { stroke-dashoffset: 60; opacity: 0; }
            }
            @keyframes demoDotLoop {
              0%          { opacity: 0; transform: scale(0); transform-box: fill-box; transform-origin: center; }
              8%          { opacity: 1; transform: scale(1.25); transform-box: fill-box; transform-origin: center; }
              18%, 83%    { opacity: 1; transform: scale(1);   transform-box: fill-box; transform-origin: center; }
              97%, 100%   { opacity: 0; transform: scale(0);   transform-box: fill-box; transform-origin: center; }
            }
          `}</style>
          <svg width="200" height="120" viewBox="0 0 200 120" fill="none" className="overflow-visible">
            {[
              { x1: 30, y1: 90, x2: 75,  y2: 40, len: 70, key: "0"  },
              { x1: 75, y1: 40, x2: 120, y2: 70, len: 60, key: "22" },
              { x1: 120,y1: 70, x2: 160, y2: 30, len: 60, key: "44" },
            ].map(l => (
              <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className="text-border"
                style={{ strokeDasharray: l.len, strokeDashoffset: l.len, animation: `demoLineLoop${l.key} 3.6s ease-in-out infinite` }}
              />
            ))}
            {[
              { cx: 30,  cy: 90, delay: 0      },
              { cx: 75,  cy: 40, delay: 0.792  },
              { cx: 120, cy: 70, delay: 1.584  },
              { cx: 160, cy: 30, delay: 2.376  },
            ].map((d, i) => (
              <g key={i}>
                <circle cx={d.cx} cy={d.cy} r="10" fill="currentColor" className="text-muted/30"
                  style={{ opacity: 0, animation: `demoDotLoop 3.6s ease-in-out ${d.delay}s infinite` }} />
                <circle cx={d.cx} cy={d.cy} r="5" fill="currentColor" className="text-foreground"
                  style={{ opacity: 0, animation: `demoDotLoop 3.6s ease-in-out ${d.delay}s infinite` }} />
              </g>
            ))}
          </svg>
          <div className="text-center space-y-2">
            <p className="text-base font-semibold text-foreground">Tworzę Twoją trasę</p>
            <p className="text-sm text-muted-foreground leading-relaxed">Ty się zrelaksuj, trasowiczu!</p>
          </div>
        </div>
      )}

      {/* Plan view - carousel identical to PlanChatExperience */}
      {showRoute && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
            <div>
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-0.5">Twoja trasa</p>
              <p className="font-black text-lg leading-tight">{city}</p>
              <p className="text-xs text-muted-foreground">
                Dzień 1 · {routePlaces.length} {routePlaces.length === 1 ? "miejsce" : routePlaces.length < 5 ? "miejsca" : "miejsc"}
              </p>
            </div>
            <button onClick={() => setShowRoute(false)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Carousel */}
          <div className="flex-1 flex items-center overflow-hidden">
            <div
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar w-full"
              style={{ paddingLeft: "10vw", paddingRight: "10vw", height: "min(520px, 68dvh)" }}
            >
              {routePlaces.map((place, i) => (
                <div
                  key={place.id}
                  className="flex-shrink-0 w-[80vw] h-full rounded-2xl overflow-hidden bg-card border border-border/40 snap-center flex flex-col"
                >
                  {/* Hero 62% */}
                  <div className="relative flex-[62] min-h-0">
                    {place.photo ? (
                      <img src={place.photo} alt={place.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-stone-100 to-stone-200">
                        {DEMO_CAT_EMOJI[place.category ?? ""] ?? "📍"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs font-bold backdrop-blur-sm">
                        {i + 1}
                      </div>
                      <span className="text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">Dzień 1</span>
                    </div>
                  </div>
                  {/* Info 38% */}
                  <div className="flex-[38] min-h-0 px-3.5 py-3 flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full self-start">
                      {DEMO_CAT_EMOJI[place.category ?? ""] ?? "📍"} {place.category ?? "Atrakcja"}
                    </span>
                    <p className="text-sm font-bold leading-tight line-clamp-2 text-foreground">{place.name}</p>
                    {place.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{place.description}</p>
                    )}
                    {i > 0 && (
                      <p className="text-[11px] text-muted-foreground/60 mt-auto">🚶 ok. 10 min</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="shrink-0 px-5 pb-8 pt-3 space-y-2 border-t border-border/10">
            <button
              onClick={() => { setShowRoute(false); setShowJournal(true); }}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-primary/20"
            >
              Zapisz trasę →
            </button>
            <button onClick={() => setShowRoute(false)} className="w-full text-center text-sm text-muted-foreground py-1">
              Wróć do dopasowań
            </button>
          </div>
        </div>
      )}

      {/* Journal preview - full app UI with Dziennik tab active */}
      {showJournal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
          {/* TopBar */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-border/40 shrink-0">
            <button onClick={() => { setShowJournal(false); setShowRoute(true); }} className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
              <span className="font-black text-sm text-foreground">trasa</span>
            </button>
            <button onClick={() => navigate("/dla-firm/start")}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-blue-600 bg-blue-600/10 active:scale-95 transition-transform">
              dla firm →
            </button>
          </div>

          {/* Journal content */}
          <div className="flex-1 overflow-y-auto px-4 pt-2 pb-2">
            <h1 className="text-xl font-black tracking-tight pt-2 pb-3">Dziennik podróży</h1>

            {/* Main journal entry - 1:1 match with JournalTab */}
            <div
              className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setShowDemoReview(true)}
            >
              <div className="relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-br from-orange-50 to-amber-100">
                {routePlaces[0]?.photo && (
                  <img
                    src={routePlaces[0].photo}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                  <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">
                    {city}<span className="font-normal text-white/80"> · Dzień 1</span>
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">
                    {new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => <span key={i} className="text-[10px]">⭐</span>)}
                  </div>
                </div>
                <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                  <Globe className="h-3 w-3 text-white/80" />
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-foreground/80 italic leading-snug mb-1.5">
                  "Wyjątkowy dzień pełen odkryć - to miasto ma niepowtarzalny charakter"
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                  Odwiedziliśmy {routePlaces.map(p => p.name).join(", ")}. Każde z tych miejsc zostawiło swój ślad.
                </p>
              </div>
            </div>

            {/* Faded placeholder suggesting more entries */}
            <div className="mt-3 rounded-2xl bg-card border border-border/50 overflow-hidden opacity-30 pointer-events-none">
              <div className="w-full aspect-[16/9] bg-muted" />
              <div className="px-4 py-3 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2 bg-muted rounded w-full" />
                <div className="h-2 bg-muted rounded w-4/5" />
              </div>
            </div>
          </div>

          {/* CTA above bottom nav */}
          <div className="shrink-0 px-4 py-3 border-t border-border/20 bg-background">
            <button
              onClick={() => navigate("/dla-firm/start")}
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-lg shadow-blue-200"
            >
              Przejdź do formularza zgłoszeniowego →
            </button>
          </div>

          {/* Fake BottomNav - Dziennik active */}
          <nav className="shrink-0 bg-background border-t border-border/40 pb-safe">
            <div className="grid grid-cols-3 h-12 max-w-lg mx-auto">
              <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground/40">
                <Home className="h-5 w-5 stroke-2" />
                <span className="text-[10px] font-medium">Główna</span>
              </button>
              <button className="flex items-center justify-center opacity-40 cursor-not-allowed">
                <span className="h-10 w-10 rounded-full bg-primary/60 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
                </span>
              </button>
              <button className="flex flex-col items-center justify-center gap-1 text-orange-600">
                <BookOpen className="h-5 w-5 stroke-[2.5px]" />
                <span className="text-[10px] font-medium">Dziennik</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* ── Demo Review Summary ─────────────────────────────────────────────── */}
      {showDemoReview && (() => {
        const heroPhoto = routePlaces[0]?.photo || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80";
        const galleryPhotos = [
          "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=500&q=80",
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80",
          "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=500&q=80",
        ];
        const demoPins = routePlaces.length > 0 ? routePlaces.map((p, i) => ({
          id: p.id,
          name: p.name,
          emoji: DEMO_CAT_EMOJI[p.category as string] ?? "📍",
          photo: p.photo,
          rating: [5, 4, 5, 4, 5][i % 5],
          isHighlight: i === 2 % routePlaces.length,
        })) : [
          { id: "d1", name: "Karmnik Restauracja & Cocktail Bar", emoji: "🍽️", photo: null, rating: 5, isHighlight: false },
          { id: "d2", name: "U Fukiera - Stare Miasto", emoji: "🍽️", photo: null, rating: 4, isHighlight: false },
          { id: "d3", name: "Bazylika Katedralna", emoji: "🏰", photo: null, rating: 5, isHighlight: true },
          { id: "d4", name: "Fotoplastikon Warszawski", emoji: "🏛️", photo: null, rating: 4, isHighlight: false },
          { id: "d5", name: "White Bear Coffee Marszałkowska", emoji: "☕", photo: null, rating: 5, isHighlight: false },
        ];
        const dateLabel = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
        return (
          <div className="fixed inset-0 z-[70] flex flex-col bg-background animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto pb-28">

              {/* Hero */}
              <div className="relative w-full bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500" style={{ aspectRatio: "4/5" }}>
                <img
                  src={heroPhoto}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />
                <button
                  onClick={() => setShowDemoReview(false)}
                  className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                >
                  <ArrowLeft className="h-5 w-5 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
                  <p className="text-white/70 text-sm mb-1">{dateLabel}</p>
                  <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm">{city}</h1>
                  <p className="text-white/70 text-base font-medium mt-0.5">Dzień 1</p>
                </div>
              </div>

              {/* Overall rating */}
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ocena trasy</p>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className="text-2xl">⭐</span>
                  ))}
                </div>
              </div>

              {/* AI highlight */}
              <div className="px-5 pt-6 pb-5 border-b border-border/30">
                <p className="text-[22px] font-bold leading-snug text-foreground">
                  „Wyjątkowy dzień pełen odkryć - to miasto ma niepowtarzalny charakter"
                </p>
              </div>

              {/* AI summary */}
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Odwiedziliśmy {demoPins.map(p => p.name).join(", ")}. Każde z tych miejsc zostawiło swój ślad i sprawiło, że ten dzień stał się niezapomniany.
                </p>
              </div>

              {/* Photos */}
              <div className="pt-5 pb-5 border-b border-border/30">
                <div className="flex items-center justify-between px-5 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zdjęcia</p>
                </div>
                <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
                  {galleryPhotos.map((url, idx) => (
                    <div key={url} className="relative flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden shadow-sm">
                      <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {idx === 0 && (
                        <div className="absolute bottom-1.5 left-1.5 bg-primary/90 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white">Okładka</div>
                      )}
                      {idx !== 0 && (
                        <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1">
                          <Star className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex-shrink-0 w-32 h-32 rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/40">
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Dodaj</span>
                  </div>
                </div>
              </div>

              {/* Visibility */}
              <div className="px-5 pt-4 pb-4 border-b border-border/30 flex items-center gap-3">
                <Globe className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Publiczne</p>
                  <p className="text-xs text-muted-foreground">Widoczne na feedzie znajomych</p>
                </div>
                <div className="flex-shrink-0 relative w-11 h-6 rounded-full bg-primary pointer-events-none">
                  <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm translate-x-5" />
                </div>
              </div>

              {/* Places with ratings */}
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Oceń miejsca</p>
                <div className="space-y-4">
                  {demoPins.map((pin) => (
                    <div key={pin.id} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center text-lg">
                          {pin.photo
                            ? <img src={pin.photo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : pin.emoji
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate">{pin.name}</p>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[1,2,3,4,5].map(n => (
                              <span key={n} className={`text-lg leading-none ${n <= pin.rating ? "opacity-100" : "opacity-20"}`}>⭐</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`w-full py-1.5 rounded-xl text-xs font-semibold border text-center ${pin.isHighlight ? "bg-amber-400/20 border-amber-400 text-amber-700" : "border-border/40 text-muted-foreground/40"}`}>
                        {pin.isHighlight ? "⭐ Miejsce dnia!" : "Wyróżnij jako miejsce dnia"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Narrative */}
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Twoje wspomnienia</p>
                <p className="text-[15px] text-foreground/70 leading-relaxed">
                  Niesamowite doświadczenie! {city} zaskoczyło nas swoją różnorodnością - od historycznych zakątków po nowoczesne kawiarnie. Każde miejsce miało swój klimat i charakter. Zdecydowanie wrócimy z całą grupą.
                </p>
              </div>

              {/* Polecajka CTA (static) */}
              <div className="px-5 pt-5 pb-6">
                <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4">
                  <p className="text-base font-black leading-tight">Podziel się tą trasą 🗺️</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Twoje miejsca trafią na discovery feed innych. Ktoś zaplanuje trasę dzięki Tobie!
                  </p>
                  <div className="mt-3 w-full py-3 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-sm text-center opacity-60">
                    Stwórz polecajkę →
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30 pb-5">
              <button
                onClick={() => navigate("/dla-firm/start")}
                className="w-full py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-blue-200"
              >
                Przejdź do formularza zgłoszeniowego →
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── DemoSession ──────────────────────────────────────────────────────────────

export default function DemoSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("location");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [likedPlaces, setLikedPlaces] = useState<DemoPlace[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [groupReactions, setGroupReactions] = useState<Record<string, { device_id: string; liked: boolean }[]>>({});
  const [otherDeviceDone, setOtherDeviceDone] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const isBiznesDemo = searchParams.get("biznes") === "1";
  const [selectedCity, setSelectedCity] = useState(DEMO_CITIES[0]);
  const [businessMode, setBusinessMode] = useState(false);
  const [realPlaces, setRealPlaces] = useState<DemoPlace[] | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [drumIndex, setDrumIndex] = useState(0);
  const drumRef = useRef<HTMLDivElement>(null);
  const [selectedSubcats, setSelectedSubcats] = useState<Set<string>>(new Set());

  const toggleSubcat = (id: string) => {
    setSelectedSubcats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMainCat = (mainCat: typeof MAIN_CATEGORIES[0]) => {
    const ids = mainCat.subcategories.map(s => s.id);
    const allSel = ids.every(id => selectedSubcats.has(id));
    setSelectedSubcats(prev => {
      const next = new Set(prev);
      if (allSel) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleMultiStart = async () => {
    if (selectedSubcats.size === 0) return;
    if (selectedSubcats.size === 1) {
      toast("Wybierz min. 2 kategorie dla lepszego efektu", {
        description: "Zobaczysz bardziej różnorodne miejsca i lepiej poznasz mozliwości aplikacji!",
        duration: 4000,
      });
      return;
    }
    const subcats = [...selectedSubcats];
    const dbValues = [...new Set(subcats.flatMap(c => CATEGORY_DB_VALUES[c] ?? [c]))];
    setCategory(subcats[0] as CategoryKey);
    setRealPlaces(null);
    setPlacesLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, category, address, rating, photo_url, vibe_tags, description, latitude, longitude")
        .ilike("city", city)
        .in("category", dbValues)
        .eq("is_active", true)
        .order("id")
        .limit(20);
      const hasPhotos = (data ?? []).some((p: any) => p.photo_url);
      if (data && data.length > 0 && hasPhotos) {
        const seed = city + subcats.join(",");
        const shuffled = subcats.length > 1
          ? interleavedShuffle(data as any[], seed)
          : seededShuffle(data as any[], seed);
        setRealPlaces(shuffled.map((p: any) => ({
          id: p.id, name: p.place_name,
          photo: !p.photo_url ? "" : (p.photo_url.startsWith("http") || p.photo_url.startsWith("/api/")) ? p.photo_url : (getPhotoUrl(p.photo_url) ?? ""),
          rating: p.rating ?? 4.5, address: p.address ?? "", tags: p.vibe_tags ?? [],
          description: p.description ?? "", latitude: p.latitude ?? undefined, longitude: p.longitude ?? undefined,
          category: p.category ?? undefined,
        })));
      } else {
        const resp = await fetch(`/api/demo-places?city=${encodeURIComponent(city)}&category=${subcats[0]}`);
        if (resp.ok) {
          const gp: DemoPlace[] = await resp.json();
          setRealPlaces(gp.length > 0 ? seededShuffle(gp, city + subcats.join(",")) : null);
        }
      }
    } catch (e) {
      console.error("[demo] multi places fetch error:", e);
    } finally {
      setPlacesLoading(false);
      setStep("swipe");
    }
  };

  // Handle ?biznes=1 - business demo starts at city picker with only Warszawa
  useEffect(() => {
    if (searchParams.get("biznes") === "1") {
      setSelectedCity("Warszawa");
      setDrumIndex(0);
      setStep("location");
    }
  }, []);

  // Handle ?city=X&skip=category - legacy param
  useEffect(() => {
    const startCity = searchParams.get("city");
    const skip = searchParams.get("skip");
    if (startCity && skip === "category") {
      setCity(startCity);
      setMode("solo");
      setStep("category");
    }
  }, []);

  // Handle ?join=CODE - second user joins existing session
  useEffect(() => {
    const joinCode = searchParams.get("join");
    if (!joinCode) return;
    (supabase as any).from("demo_sessions").select("*").eq("code", joinCode).single()
      .then(({ data }: any) => {
        if (data) {
          setCity(data.city);
          setCategory(data.category as CategoryKey);
          setSessionCode(joinCode);
          setMode("group");
          setStep("swipe");
        } else {
          toast.error("Nie znaleziono sesji - sprawdź kod i spróbuj ponownie");
        }
      });
  }, []);

  const places: DemoPlace[] = realPlaces ?? [];

  const handleStartSolo = () => { setMode("solo"); setStep("location"); };
  const handleStartGroup = () => { setMode("group"); setStep("location"); };

  const handleJoinByCode = async () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) return;
    setJoinLoading(true);
    try {
      const { data } = await (supabase as any).from("demo_sessions").select("*").eq("code", code).single();
      if (data) {
        setCity(data.city);
        setCategory(data.category as CategoryKey);
        setSessionCode(code);
        setMode("group");
        setStep("swipe");
      } else {
        toast.error("Nie znaleziono sesji - sprawdź kod i spróbuj ponownie");
      }
    } catch {
      toast.error("Błąd połączenia - spróbuj ponownie");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCitySelect = (c: string) => { setCity(c); setStep("mode"); };

  // Shared place loader - used by both host (handleCategorySelect) and joiner (useEffect)
  const loadPlaces = async (targetCity: string, cat: string) => {
    setPlacesLoading(true);
    try {
      // DB first, ordered by id for deterministic base order
      const dbValues = CATEGORY_DB_VALUES[cat] ?? [cat];
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, category, address, rating, photo_url, vibe_tags, description, latitude, longitude")
        .ilike("city", targetCity)
        .in("category", dbValues)
        .eq("is_active", true)
        .order("id")
        .limit(12);

      const hasPhotos = (data ?? []).some((p: any) => p.photo_url);

      if (data && data.length > 0 && hasPhotos) {
        const seed = targetCity + cat;
        const shuffled = seededShuffle(data as any[], seed);
        setRealPlaces(shuffled.map((p: any) => ({
          id: p.id,
          name: p.place_name,
          photo: !p.photo_url ? ""
            : (p.photo_url.startsWith("http") || p.photo_url.startsWith("/api/")) ? p.photo_url
            : (getPhotoUrl(p.photo_url) ?? ""),
          rating: p.rating ?? 4.5,
          address: p.address ?? "",
          tags: p.vibe_tags ?? [],
          description: p.description ?? "",
          latitude: p.latitude ?? undefined,
          longitude: p.longitude ?? undefined,
          category: p.category ?? undefined,
        })));
      } else {
        // No photos in DB → fetch from Google Places (cached 24h at CDN)
        const resp = await fetch(`/api/demo-places?city=${encodeURIComponent(targetCity)}&category=${cat}`);
        if (resp.ok) {
          const googlePlaces: DemoPlace[] = await resp.json();
          // Apply same seed shuffle to Google results too
          const seed = targetCity + cat;
          setRealPlaces(googlePlaces.length > 0 ? seededShuffle(googlePlaces, seed) : null);
        }
      }
    } catch (e) {
      console.error("[demo] places fetch error:", e);
    } finally {
      setPlacesLoading(false);
    }
  };

  // Joiner: when they land on step="swipe" via join code/link, places are not loaded yet
  useEffect(() => {
    if (step !== "swipe" || !city || !category || realPlaces !== null || placesLoading) return;
    loadPlaces(city, category);
  }, [step, city, category]);

  const handleCategorySelect = async (cat: CategoryKey) => {
    setCategory(cat);
    setRealPlaces(null);
    await loadPlaces(city, cat);

    if (mode === "group") {
      setGroupLoading(true);
      try {
        const code = generateJoinCode();
        const { error } = await (supabase as any).from("demo_sessions").insert({ code, city, category: cat });
        if (error) throw error;
        setSessionCode(code);
        setStep("invite");
      } catch (e: any) {
        console.error("[demo] session create error:", e);
        toast.error("Nie udało się utworzyć sesji - spróbuj ponownie");
      } finally {
        setGroupLoading(false);
      }
    } else {
      setStep("swipe");
    }
  };

  const handleSwipeComplete = async (liked: DemoPlace[]) => {
    setLikedPlaces(liked);
    if (mode === "group" && sessionCode) {
      const deviceId = getDeviceId();
      const allPlaces = realPlaces ?? [];
      const reactions = allPlaces.map(p => ({
        session_code: sessionCode,
        device_id: deviceId,
        place_name: p.name,
        liked: liked.some(l => l.id === p.id),
      }));
      try {
        await (supabase as any).from("demo_reactions").upsert(reactions);
        const { data: allReactions } = await (supabase as any)
          .from("demo_reactions").select("*").eq("session_code", sessionCode);
        if (allReactions) {
          const byPlace: Record<string, { device_id: string; liked: boolean }[]> = {};
          for (const r of allReactions) {
            if (!byPlace[r.place_name]) byPlace[r.place_name] = [];
            byPlace[r.place_name].push({ device_id: r.device_id, liked: r.liked });
          }
          setGroupReactions(byPlace);
          const uniqueDevices = new Set(allReactions.map((r: any) => r.device_id));
          setOtherDeviceDone(uniqueDevices.size >= 2);
        }
      } catch (e) {
        console.error("[demo] failed to save reactions:", e);
      }
    }
    setStep("results");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/demo?join=${sessionCode}`);
    toast.success("Link skopiowany!");
  };

  const catLabel = DEMO_CATEGORIES.find(c => c.id === category);
  const swipeCategoryLabel = selectedSubcats.size > 1
    ? `${selectedSubcats.size} kategorie`
    : catLabel ? `${catLabel.emoji} ${catLabel.label}` : null;

  // Group matches: places liked by both devices
  const groupMatches: DemoPlace[] = mode === "group" && otherDeviceDone
    ? (realPlaces ?? []).filter(p => {
        const r = groupReactions[p.name] ?? [];
        return r.length >= 2 && r.every(x => x.liked);
      })
    : [];

  return (
    <div className="flex flex-col h-dvh bg-background max-w-lg mx-auto">
      {/* Pre-launch context strip */}
      {isBiznesDemo && (
        <div className="shrink-0 bg-blue-600 text-white text-[11px] font-semibold text-center py-1.5 px-4">
          Demo pre-launch · Tak wyglądają lokale dla użytkownika · Premiera czerwiec 2026
        </div>
      )}
      {/* Header - hidden on landing */}
      {step !== "city" && step !== "swipe" && (
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          {step !== "location" && (
            <button
              onClick={() => {
                if (step === "category") setStep("location");
                else if (step === "invite") setStep("category");
                else if (step === "results") setStep("swipe");
              }}
              className="h-9 w-9 flex items-center justify-center -ml-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <p className="font-bold text-sm leading-tight">
              {step === "location" ? "Wybierz miasto"
                : step === "category" ? city
                : step === "invite" ? "Zaproś znajomego"
                : mode === "group" ? "Wspólne dopasowania" : "Twoje propozycje"}
            </p>
            {step === "results" && <p className="text-xs text-muted-foreground">{city}</p>}
          </div>
          {isBiznesDemo && (
            <button
              onClick={() => navigate("/dla-firm/start")}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-blue-600 bg-blue-600/10 active:scale-95 transition-transform shrink-0"
            >
              dla firm →
            </button>
          )}
        </div>
      )}

      {/* Swipe header - same height/structure as regular header */}
      {step === "swipe" && (
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button
            onClick={() => { if (mode === "group" && sessionCode) setStep("invite"); else setStep("category"); }}
            className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className="font-bold text-sm leading-tight">{city}</p>
            {swipeCategoryLabel && (
              <span className="text-sm font-semibold text-orange-600 truncate">{swipeCategoryLabel}</span>
            )}
          </div>
          {isBiznesDemo && (
            <button
              onClick={() => navigate("/dla-firm/start")}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-blue-600 bg-blue-600/10 active:scale-95 transition-transform shrink-0"
            >
              dla firm →
            </button>
          )}
        </div>
      )}

      {/* ── STEP: city (landing) ── */}
      {step === "city" && (
        <div className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-0">
            <div className="h-7 w-7 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <button
              onClick={() => navigate("/dla-firm/start")}
              className="text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform text-blue-600 bg-blue-600/10"
            >
              dla firm →
            </button>
          </div>

          {businessMode ? (
            /* ── Business landing ── */
            <div className="px-5 pt-6 pb-10 space-y-8">
              {/* Hero */}
              <div className="overflow-hidden flex items-center gap-2">
                <div className="flex-1 z-10">
                  <h1 className="text-3xl font-black leading-tight">Bądź tam,<br/>gdzie szukają<br/>klienci.</h1>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-[200px]">
                    Twój lokal w trasach tworzonych przez turystów i lokalsów - bez reklam, z prawdziwym zasięgiem.
                  </p>
                </div>
                <div className="relative shrink-0" style={{ width: "148px", height: "210px", marginRight: "-48px" }}>
                  <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-md"
                    style={{ transform: "rotate(-8deg) translate(-28px, 16px)" }}>
                    <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=80" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Kawiarnia</span>
                      <p className="text-white text-[11px] font-bold mt-0.5">Charlotte</p>
                      <p className="text-yellow-400 text-[9px]">★ 4.8</p>
                    </div>
                  </div>
                  <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white"
                    style={{ transform: "rotate(-2deg) translate(-8px, -6px)" }}>
                    <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">★ Premium</div>
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <div className="w-6 h-6 rounded-full mb-1 border border-white/40 overflow-hidden"
                        style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
                      <p className="text-white text-[11px] font-black leading-tight">Butchery & Wine</p>
                      <p className="text-white/60 text-[9px]">Restauracja · @trasa</p>
                      <p className="text-yellow-400 text-[9px] mt-0.5">★ 4.7</p>
                      <div className="mt-1 inline-flex items-center gap-0.5 bg-blue-500/80 rounded-full px-1.5 py-0.5">
                        <span className="text-white text-[8px] font-semibold">🎉 Wydarzenie dziś</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                {[
                  { icon: "📍", text: "Pojawiaj się w trasach tworzonych przez użytkowników" },
                  { icon: "📊", text: "Śledź ile osób odwiedza Twój lokal dzięki Trasie" },
                  { icon: "🤝", text: "Bezpośredni kontakt z turystami i lokalsami" },
                ].map(item => (
                  <div key={item.icon} className="flex items-start gap-3 bg-card rounded-2xl px-4 py-4 border border-border/40">
                    <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                    <p className="text-sm font-medium leading-snug">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/auth?business=true")}
                  className="w-full py-3.5 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-blue-600/25"
                >
                  Zaloguj się jako firma
                </button>
                <button
                  onClick={() => navigate("/auth?business=true")}
                  className="w-full py-3.5 rounded-full bg-white border-2 border-blue-600 text-blue-600 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                >
                  Zarejestruj lokal
                </button>
              </div>
            </div>
          ) : (
            /* ── User landing ── */
            <div className="px-5 pt-6 pb-10 space-y-8">
              {/* Hero */}
              <div className="overflow-hidden flex items-center gap-2">
                <div className="flex-1 z-10">
                  <h1 className="text-3xl font-black leading-tight">Speed dating<br/>z miastem</h1>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-[170px]">
                    Odkryj kawiarnie, restauracje i atrakcje razem z ekipą.
                  </p>
                </div>
                <div className="relative shrink-0" style={{ width: "148px", height: "210px", marginRight: "-48px" }}>
                  <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-md"
                    style={{ transform: "rotate(-8deg) translate(-28px, 16px)" }}>
                    <img src="https://images.unsplash.com/photo-1519197924294-4ba991a11128?w=400&q=80" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">Park</span>
                      <p className="text-white text-[11px] font-bold mt-0.5">Łazienki</p>
                      <p className="text-yellow-400 text-[9px]">★ 4.9</p>
                    </div>
                  </div>
                  <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-lg"
                    style={{ transform: "rotate(7deg) translate(10px, -12px)" }}>
                    <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Restauracja</span>
                      <p className="text-white text-[11px] font-bold mt-0.5">Butchery & Wine</p>
                      <p className="text-yellow-400 text-[9px]">★ 4.7</p>
                    </div>
                  </div>
                  <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white"
                    style={{ transform: "rotate(-2deg) translate(-8px, -6px)" }}>
                    <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=80" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Kawiarnia</span>
                      <p className="text-white text-[11px] font-bold mt-0.5">Charlotte</p>
                      <p className="text-yellow-400 text-[9px]">★ 4.8</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div>
                <button
                  onClick={() => { setMode("solo"); setCity("Warszawa"); setStep("category"); }}
                  className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
                >
                  Zacznij
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: location ── */}
      {step === "location" && (() => {
        const ITEM_H = 64;
        const LOCATION_CITIES = isBiznesDemo
          ? [{ name: "Warszawa", locked: false }]
          : DEMO_CITIES_DATA;
        const COUNTRIES = [
          { flag: "🇵🇱", name: "Polska",     available: true  },
          { flag: "🇮🇹", name: "Włochy",     available: false },
          { flag: "🇪🇸", name: "Hiszpania",  available: false },
          { flag: "🇫🇷", name: "Francja",    available: false },
          { flag: "🇩🇪", name: "Niemcy",     available: false },
          { flag: "🇵🇹", name: "Portugalia", available: false },
          { flag: "🇭🇷", name: "Chorwacja",  available: false },
          { flag: "🇬🇷", name: "Grecja",     available: false },
          { flag: "🇦🇹", name: "Austria",    available: false },
          { flag: "🇨🇿", name: "Czechy",     available: false },
          { flag: "🇭🇺", name: "Węgry",      available: false },
          { flag: "🇳🇱", name: "Holandia",   available: false },
          { flag: "🇲🇹", name: "Malta",      available: false },
        ];
        return (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Country selector */}
            <div className="px-5 pt-4 pb-3 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Kraj</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {COUNTRIES.map(c => (
                  <button
                    key={c.name}
                    disabled={!c.available}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-semibold shrink-0 transition-all",
                      c.available
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border/40 text-muted-foreground/50"
                    )}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                    {!c.available && (
                      <span className="text-[10px] font-normal ml-0.5 opacity-70">wkrótce</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Drum scroll */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              {/* Center highlight line */}
              <div className="absolute left-0 right-0 pointer-events-none z-10"
                style={{ top: "50%", transform: "translateY(-50%)", height: `${ITEM_H}px` }}>
                <div className="mx-8 h-full rounded-2xl bg-primary/8" />
              </div>

              <div
                ref={drumRef}
                onScroll={() => {
                  const el = drumRef.current;
                  if (!el) return;
                  const idx = Math.round(el.scrollTop / ITEM_H);
                  setDrumIndex(Math.min(Math.max(idx, 0), LOCATION_CITIES.length - 1));
                  setSelectedCity(LOCATION_CITIES[Math.min(Math.max(idx, 0), LOCATION_CITIES.length - 1)].name);
                }}
                className="w-full overflow-y-scroll no-scrollbar"
                style={{
                  height: `${ITEM_H * 5}px`,
                  scrollSnapType: "y mandatory",
                  scrollBehavior: "smooth",
                }}
              >
                {/* Top padding to center first item */}
                <div style={{ height: `${ITEM_H * 2}px` }} />
                {LOCATION_CITIES.map((city, i) => {
                  const dist = Math.abs(i - drumIndex);
                  const isLocked = city.locked;
                  return (
                    <div
                      key={city.name}
                      style={{ height: `${ITEM_H}px`, scrollSnapAlign: "center" }}
                      className="flex items-center justify-center gap-2 cursor-pointer"
                      onClick={() => {
                        setDrumIndex(i);
                        setSelectedCity(city.name);
                        drumRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
                      }}
                    >
                      <span className={cn(
                        "font-black transition-all duration-150 select-none",
                        dist === 0 && !isLocked && "text-4xl text-foreground",
                        dist === 0 && isLocked  && "text-4xl text-foreground/25",
                        dist === 1 && !isLocked && "text-2xl text-foreground/40",
                        dist === 1 && isLocked  && "text-2xl text-foreground/15",
                        dist === 2 && "text-xl text-foreground/10",
                        dist >= 3  && "text-lg text-foreground/[0.06]",
                      )}>
                        {city.name}
                      </span>
                      {isLocked && dist <= 1 && (
                        <span className={cn(
                          "transition-all duration-150",
                          dist === 0 ? "text-foreground/25 text-xl" : "text-foreground/10 text-base"
                        )}>🔒</span>
                      )}
                    </div>
                  );
                })}
                {/* Bottom padding to center last item */}
                <div style={{ height: `${ITEM_H * 2}px` }} />
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 pt-3 pb-8 shrink-0">
              {(() => {
                const cityData = LOCATION_CITIES[drumIndex];
                const locked = cityData?.locked;
                return (
                  <button
                    onClick={() => { if (!locked) { setCity(selectedCity); setStep("category"); } }}
                    disabled={locked}
                    className={cn(
                      "w-full py-3.5 rounded-full font-bold text-base active:scale-[0.97] transition-transform",
                      locked
                        ? "bg-muted text-muted-foreground cursor-default shadow-none"
                        : "bg-primary text-white shadow-lg shadow-primary/25"
                    )}
                  >
                    {locked ? `${selectedCity} - wkrótce 🔒` : `Dalej - ${selectedCity}`}
                  </button>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── STEP: category ── */}
      {step === "category" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-4">
            <div>
              <p className="text-xl font-black mb-1">Co Cię interesuje?</p>
              <p className="text-sm text-muted-foreground">
                Wybierz kategorie - zobaczysz miejsca ze wszystkich wybranych.
              </p>
            </div>
            {MAIN_CATEGORIES.map(cat => {
              const allSel = cat.subcategories.every(s => selectedSubcats.has(s.id));
              const someSel = cat.subcategories.some(s => selectedSubcats.has(s.id));
              return (
                <div key={cat.id} className="space-y-2">
                  <button
                    onClick={() => toggleMainCat(cat)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.98]",
                      allSel
                        ? "bg-transparent border-orange-600"
                        : someSel
                          ? "bg-transparent border-orange-500/50"
                          : "bg-card border-border/40"
                    )}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{cat.hint}</p>
                    </div>
                    {allSel && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                  </button>
                  <div className="flex flex-wrap gap-2 pl-2">
                    {cat.subcategories.map(sub => {
                      const sel = selectedSubcats.has(sub.id);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => toggleSubcat(sub.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95",
                            sel
                              ? "bg-transparent text-orange-600 border-orange-600"
                              : "bg-card text-muted-foreground border-border/60"
                          )}
                        >
                          <span>{sub.emoji}</span>
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shrink-0 px-4 pb-8 pt-2 space-y-3">
            <button
              onClick={handleMultiStart}
              disabled={selectedSubcats.size === 0 || placesLoading}
              className={cn(
                "w-full py-3.5 rounded-full font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform",
                selectedSubcats.size > 0
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {placesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedSubcats.size > 0 ? `Eksploruj (${selectedSubcats.size})` : "Wybierz kategorie"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: invite ── */}
      {step === "invite" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 space-y-5">
            <div>
              <p className="text-2xl font-black mb-1.5">Zaproś znajomego</p>
              <p className="text-sm text-muted-foreground">Wyślij kod lub link - gdy dołączy, zaczniecie swipe'ować te same miejsca i zobaczycie co Was łączy.</p>
            </div>

            <div className="rounded-2xl bg-muted/60 px-5 py-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kod sesji</p>
                <p className="text-3xl font-black tracking-widest text-foreground">{sessionCode}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="h-10 w-10 rounded-full bg-card border border-border/60 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              >
                {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 rounded-full border border-border/60 bg-card text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              Skopiuj link zaproszenia
            </button>

            <div className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Znajomy otwiera link i od razu trafia do tej samej sesji - zero rejestracji.
            </div>
          </div>
          <div className="shrink-0 px-5 pb-8 pt-3">
            <button
              onClick={() => setStep("swipe")}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20"
            >
              <Users className="h-5 w-5" />
              Zaczynamy!
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: swipe ── */}
      {step === "swipe" && (
        places.length > 0
          ? <DemoSwiper places={places} city={city} category={category!} onComplete={handleSwipeComplete} isBiznesDemo={isBiznesDemo} />
          : <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <p className="text-4xl">😕</p>
              <p className="font-bold text-lg">Brak miejsc dla tej kategorii</p>
              <p className="text-sm text-muted-foreground">Spróbuj innej kategorii lub miasta.</p>
              <button
                onClick={() => setStep("category")}
                className="py-3 px-6 rounded-2xl bg-primary text-white font-semibold text-sm"
              >
                ← Wróć do kategorii
              </button>
            </div>
      )}

      {/* ── STEP: results ── */}
      {step === "results" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4">

            {/* Group: waiting for partner */}
            {mode === "group" && !otherDeviceDone && (
              <div className="rounded-2xl bg-muted/50 border border-border/40 px-5 py-5 flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-6 w-6 text-orange-600 animate-spin" />
                <p className="font-semibold">Czekamy na znajomego…</p>
                <p className="text-xs text-muted-foreground">Gdy skończy swipe'ować, zobaczycie wspólne dopasowania.</p>
                <p className="text-xs font-mono bg-background border border-border/50 px-3 py-1.5 rounded-2xl">{sessionCode}</p>
              </div>
            )}

            {/* Group: both done - show matches */}
            {mode === "group" && otherDeviceDone && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {groupMatches.length > 0 ? "Macie wspólne miejsca! 🎉" : "Brak dopasowań"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {groupMatches.length > 0
                    ? `${groupMatches.length} ${groupMatches.length === 1 ? "miejsce" : groupMatches.length < 5 ? "miejsca" : "miejsc"} polubiliście oboje`
                    : "Tym razem się nie pokryło - spróbujcie innej kategorii"}
                </p>
              </div>
            )}

            {/* Solo results header */}
            {mode === "solo" && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {likedPlaces.length > 0 ? "Twoje propozycje 🎉" : "Żadnych lajków"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {likedPlaces.length > 0
                    ? `Polubiłeś/aś ${likedPlaces.length} ${likedPlaces.length === 1 ? "miejsce" : likedPlaces.length < 5 ? "miejsca" : "miejsc"} w ${city}`
                    : "Spróbuj jeszcze raz i polub jakieś miejsca!"}
                </p>
              </div>
            )}

            {/* Place list */}
            {(mode === "solo" ? likedPlaces : groupMatches).length > 0 && (
              <div className="space-y-2">
                {(mode === "solo" ? likedPlaces : groupMatches).map((place, i) => (
                  <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
                    <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                      {i + 1}
                    </span>
                    <img src={place.photo} alt={place.name} className="h-10 w-10 rounded-2xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upsell */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-600/10 to-orange-500/5 border border-orange-600/20 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-600" />
                <p className="font-bold text-base">Spodobało się?</p>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>✓ Paruj miejsca razem ze znajomymi</li>
                <li>✓ Nieograniczone kategorie i rundy</li>
                <li>✓ Zapisz trasę i nawiguj po niej</li>
                <li>✓ Historia wszystkich wspólnych planów</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0 px-4 pb-8 pt-3 space-y-2">
            <button
              onClick={() => {
                const places = mode === "solo" ? likedPlaces : groupMatches;
                saveDemoLikedToStorage(places, city, category ?? "");
                navigate("/auth");
              }}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-primary/20"
            >
              Załóż konto - zajmuje 30 sekund →
            </button>
            <button
              onClick={() => { setStep("category"); setCategory(null); setLikedPlaces([]); setGroupReactions({}); setOtherDeviceDone(false); setSelectedSubcats(new Set()); }}
              className="w-full py-3 rounded-full border border-border/50 text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
            >
              Spróbuj innej kategorii
            </button>
          </div>
        </div>
      )}

      {/* Demo info banner - shown on every step */}
      <div className="shrink-0 px-4 pb-3 pt-1">
        <div className="rounded-2xl bg-muted/50 px-4 py-3 flex items-start gap-3">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Demo pokazuje działanie aplikacji. Pełne działanie aplikacji zawiera znacznie większą bazę miast oraz miejsc.
          </p>
        </div>
      </div>
    </div>
  );
}
