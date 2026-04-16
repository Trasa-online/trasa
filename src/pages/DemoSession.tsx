import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPhotoUrl } from "@/lib/placePhotos";
import { ArrowLeft, Lock, Sparkles, Users, User, Copy, Check, Loader2, Search, UserPlus } from "lucide-react";
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

// Deterministic shuffle — same city+category → same order for every user
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
}

type CategoryKey = "cafe" | "restaurant" | "bar" | "museum" | "park" | "experience" | "shopping";

// Maps UI category id → DB category values (one id can cover multiple DB values)
const CATEGORY_DB_VALUES: Record<string, string[]> = {
  cafe:       ["cafe"],
  restaurant: ["restaurant"],
  bar:        ["bar"],
  museum:     ["museum", "monument"],
  park:       ["park", "viewpoint"],
  experience: ["experience"],
  shopping:   ["shopping", "market"],
};

const DEMO_CITIES_DATA = [
  { name: 'Kraków',     locked: false },
  { name: 'Łódź',      locked: false },
  { name: 'Warszawa',   locked: false },
  { name: 'Trójmiasto', locked: false },
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

// ─── Convert DemoPlace → MockPlace ────────────────────────────────────────────

function toMock(p: DemoPlace, city: string, category: string): MockPlace {
  return {
    id: p.id,
    place_name: p.name,
    category: category as PlaceCategory,
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

function DemoSwiper({ places, city, category, onComplete }: {
  places: DemoPlace[];
  city: string;
  category: string;
  onComplete: (liked: DemoPlace[]) => void;
}) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DemoPlace[]>(places);
  const [liked, setLiked] = useState<DemoPlace[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "matches">("explore");
  const [showUpsell, setShowUpsell] = useState(false);

  // Auto-switch to matches when all cards are swiped
  useEffect(() => {
    if (queue.length === 0 && activeTab === "explore") setActiveTab("matches");
  }, [queue.length]);

  const mockQueue = queue.map(p => toMock(p, city, category));
  const cardSlice = mockQueue.slice(0, 3);
  const swiped = places.length - queue.length;

  const handleLike = () => {
    setLiked(prev => [...prev, queue[0]]);
    setQueue(prev => prev.slice(1));
  };

  const handleSkip = () => {
    setQueue(prev => prev.slice(1));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs — full-width like GroupSession */}
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
            <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
              {liked.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Eksploruj ── */}
      {activeTab === "explore" && (
        <>
          <div className="px-5 py-2 text-xs text-muted-foreground shrink-0">
            Miejsce {swiped}/{places.length}
          </div>

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
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <p className="text-5xl">✅</p>
              <p className="font-bold text-lg">Przejrzałeś wszystkie miejsca!</p>
              <p className="text-sm text-muted-foreground">Sprawdź swoje dopasowania w drugiej zakładce.</p>
              <button
                onClick={() => setActiveTab("matches")}
                className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.97] transition-transform"
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
              <p className="text-sm text-muted-foreground">Swipe'uj miejsca i wróć tutaj</p>
              <button onClick={() => setActiveTab("explore")} className="text-sm font-semibold text-orange-600">
                Wróć do eksplorowania →
              </button>
            </div>
          ) : (
            <>
              {liked.map((place, i) => (
                <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
                  <span className="h-7 w-7 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {i + 1}
                  </span>
                  <img src={place.photo} alt={place.name} className="h-12 w-12 rounded-2xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowUpsell(true)}
                className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform mt-1"
              >
                Stwórz trasę →
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

      {/* Upsell modal */}
      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-t-3xl px-6 pt-8 pb-10 flex flex-col items-center gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="h-14 w-14 rounded-2xl bg-orange-600/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-orange-600" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-2xl font-black">Dołącz do Trasy!</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Załóż konto i stwórz prawdziwą trasę z Twoich ulubionych miejsc. Zajmuje 30 sekund.
              </p>
            </div>
            <ul className="w-full space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Zapisz trasę i nawiguj po niej</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Paruj miejsca razem z grupą znajomych</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Nieograniczone kategorie i rundy</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Historia wszystkich wspólnych planów</li>
            </ul>
            <button
              onClick={() => {
                saveDemoLikedToStorage(liked, city, category);
                navigate("/auth");
              }}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/25"
            >
              Załóż konto — to nic nie kosztuje →
            </button>
            <button
              onClick={() => setShowUpsell(false)}
              className="text-sm text-muted-foreground"
            >
              Wróć do demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DemoSession ──────────────────────────────────────────────────────────────

export default function DemoSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("city");
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
  const [selectedCity, setSelectedCity] = useState(DEMO_CITIES[0]);
  const [businessMode, setBusinessMode] = useState(false);
  const [realPlaces, setRealPlaces] = useState<DemoPlace[] | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [drumIndex, setDrumIndex] = useState(0);
  const drumRef = useRef<HTMLDivElement>(null);

  // Handle ?join=CODE — second user joins existing session
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
          toast.error("Nie znaleziono sesji — sprawdź kod i spróbuj ponownie");
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
        toast.error("Nie znaleziono sesji — sprawdź kod i spróbuj ponownie");
      }
    } catch {
      toast.error("Błąd połączenia — spróbuj ponownie");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCitySelect = (c: string) => { setCity(c); setStep("mode"); };

  // Shared place loader — used by both host (handleCategorySelect) and joiner (useEffect)
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
        toast.error("Nie udało się utworzyć sesji — spróbuj ponownie");
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

  // Group matches: places liked by both devices
  const groupMatches: DemoPlace[] = mode === "group" && otherDeviceDone
    ? (realPlaces ?? []).filter(p => {
        const r = groupReactions[p.name] ?? [];
        return r.length >= 2 && r.every(x => x.liked);
      })
    : [];

  return (
    <div className="flex flex-col h-dvh bg-background max-w-lg mx-auto">
      {/* Header — hidden on landing */}
      {step !== "city" && step !== "swipe" && (
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button
            onClick={() => {
              if (step === "location") setStep("city");
              else if (step === "category") setStep("location");
              else if (step === "invite") setStep("category");
              else if (step === "results") setStep("swipe");
            }}
            className="h-9 w-9 flex items-center justify-center -ml-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="font-bold text-sm leading-tight">
              {step === "location" ? "Wybierz miasto"
                : step === "category" ? city
                : step === "invite" ? "Zaproś znajomego"
                : mode === "group" ? "Wspólne dopasowania" : "Twoje propozycje"}
            </p>
            {step === "results" && <p className="text-xs text-muted-foreground">{city}</p>}
          </div>
        </div>
      )}

      {/* GroupSession-style header — swipe step only */}
      {step === "swipe" && (
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button
            onClick={() => { if (mode === "group" && sessionCode) setStep("invite"); else setStep("category"); }}
            className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base leading-tight">{city}</p>
              {catLabel && (
                <span className="text-sm font-semibold text-orange-600">
                  {catLabel.emoji} {catLabel.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "group" ? "3 osoby" : "1 osoba"}
              {sessionCode ? ` · #${sessionCode}` : " · #DEMO"}
              {" · runda 1"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Demo member avatars */}
            <div className="flex -space-x-2">
              {(mode === "group" ? ["T", "M", "J"] : ["T"]).map((initial, i) => (
                <div key={i} className="h-7 w-7 rounded-full bg-orange-600/20 border-2 border-background flex items-center justify-center text-xs font-bold text-orange-700">
                  {initial}
                </div>
              ))}
            </div>
            <button className="h-7 w-7 rounded-full bg-muted flex items-center justify-center" title="Szukaj miejsca">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="h-7 w-7 rounded-full bg-muted flex items-center justify-center" title="Zaproś do sesji">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: city (landing) ── */}
      {step === "city" && (
        <div className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-0">
            <div className="h-7 w-7 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <button
              onClick={() => setBusinessMode(b => !b)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform text-blue-600 bg-blue-600/10"
            >
              {businessMode ? "← dla turystów" : "dla firm →"}
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
                    Twój lokal w trasach tworzonych przez turystów i lokalsów — bez reklam, z prawdziwym zasięgiem.
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
                  className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-blue-600/25"
                >
                  Zaloguj się jako firma
                </button>
                <button
                  onClick={() => navigate("/auth?business=true")}
                  className="w-full py-3.5 rounded-2xl bg-white border-2 border-blue-600 text-blue-600 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
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
                  <h1 className="text-3xl font-black leading-tight">Speed dating<br/>z miastem.</h1>
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
                      <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">Restauracja</span>
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

              {/* CTAs */}
              <div className="space-y-3">
                <button
                  onClick={handleStartGroup}
                  className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/25"
                >
                  <Users className="h-5 w-5" />
                  Zacznij z grupą
                </button>
                <button
                  onClick={handleStartSolo}
                  className="w-full py-3.5 rounded-2xl bg-white border-2 border-orange-600 text-orange-600 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                >
                  <User className="h-5 w-5" />
                  Zacznij solo
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Masz konto?{" "}
                  <button onClick={() => navigate("/auth")} className="text-orange-600 font-semibold">
                    Zaloguj się →
                  </button>
                </p>
              </div>

              {/* Join by code */}
              <div className="rounded-2xl border border-border/50 bg-card px-4 py-4 space-y-2.5">
                <p className="text-sm font-semibold">Masz kod zaproszenia?</p>
                <div className="flex gap-2">
                  <input
                    value={joinInput}
                    onChange={e => setJoinInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleJoinByCode()}
                    placeholder="np. ABC123"
                    maxLength={8}
                    className="flex-1 px-3 py-2.5 rounded-2xl border border-border/60 bg-background text-sm font-mono font-bold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-orange-600/30"
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinInput.trim().length < 4 || joinLoading}
                    className="px-4 py-2.5 rounded-2xl bg-orange-600 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.97] transition-transform flex items-center gap-1.5"
                  >
                    {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dołącz"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: location ── */}
      {step === "location" && (() => {
        const ITEM_H = 64;
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
                <div className="mx-8 h-full rounded-2xl bg-orange-600/8" />
              </div>

              <div
                ref={drumRef}
                onScroll={() => {
                  const el = drumRef.current;
                  if (!el) return;
                  const idx = Math.round(el.scrollTop / ITEM_H);
                  setDrumIndex(Math.min(Math.max(idx, 0), DEMO_CITIES.length - 1));
                  setSelectedCity(DEMO_CITIES[Math.min(Math.max(idx, 0), DEMO_CITIES.length - 1)]);
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
                {DEMO_CITIES_DATA.map((city, i) => {
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
                const cityData = DEMO_CITIES_DATA[drumIndex];
                const locked = cityData?.locked;
                return (
                  <button
                    onClick={() => { if (!locked) { setCity(selectedCity); setStep("category"); } }}
                    disabled={locked}
                    className={cn(
                      "w-full py-3.5 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform",
                      locked
                        ? "bg-muted text-muted-foreground cursor-default shadow-none"
                        : "bg-orange-600 text-white shadow-lg shadow-orange-600/25"
                    )}
                  >
                    {locked ? `${selectedCity} — wkrótce 🔒` : `Dalej — ${selectedCity}`}
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
          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-5">
            <div>
              <p className="text-xl font-black mb-1">Wybierz kategorię</p>
              <p className="text-sm text-muted-foreground">
                {mode === "group" ? "Wybierz kategorię i zaproś znajomego — oboje będziecie swipe'ować te same miejsca." : "W demo możesz wybrać 1 kategorię i przejrzeć 8 miejsc."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_CATEGORIES.map(cat => {
                const isLoading = (placesLoading || groupLoading) && category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id as CategoryKey)}
                    disabled={placesLoading || groupLoading}
                    className="px-4 py-3 rounded-2xl text-sm font-semibold border border-border/60 bg-card flex items-center gap-2 active:scale-[0.97] transition-transform hover:border-orange-600/40 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{cat.emoji}</span>}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 px-4 pb-8 pt-2">
            <div className="rounded-2xl bg-muted/50 px-4 py-3 flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Pełna wersja: nieograniczone kategorie, rundy z grupą znajomych i zapisywanie tras.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: invite ── */}
      {step === "invite" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 space-y-5">
            <div>
              <p className="text-2xl font-black mb-1.5">Zaproś znajomego</p>
              <p className="text-sm text-muted-foreground">Wyślij kod lub link — gdy dołączy, zaczniecie swipe'ować te same miejsca i zobaczycie co Was łączy.</p>
            </div>

            <div className="rounded-2xl bg-muted/60 px-5 py-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kod sesji</p>
                <p className="text-3xl font-black tracking-widest text-foreground">{sessionCode}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="h-10 w-10 rounded-2xl bg-card border border-border/60 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              >
                {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 rounded-2xl border border-border/60 bg-card text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              Skopiuj link zaproszenia
            </button>

            <div className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Znajomy otwiera link i od razu trafia do tej samej sesji — zero rejestracji.
            </div>
          </div>
          <div className="shrink-0 px-5 pb-8 pt-3">
            <button
              onClick={() => setStep("swipe")}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/20"
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
          ? <DemoSwiper places={places} city={city} category={category!} onComplete={handleSwipeComplete} />
          : <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <p className="text-4xl">😕</p>
              <p className="font-bold text-lg">Brak miejsc dla tej kategorii</p>
              <p className="text-sm text-muted-foreground">Spróbuj innej kategorii lub miasta.</p>
              <button
                onClick={() => setStep("category")}
                className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm"
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

            {/* Group: both done — show matches */}
            {mode === "group" && otherDeviceDone && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {groupMatches.length > 0 ? "Macie wspólne miejsca! 🎉" : "Brak dopasowań"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {groupMatches.length > 0
                    ? `${groupMatches.length} ${groupMatches.length === 1 ? "miejsce" : groupMatches.length < 5 ? "miejsca" : "miejsc"} polubiliście oboje`
                    : "Tym razem się nie pokryło — spróbujcie innej kategorii"}
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
                    <span className="h-7 w-7 rounded-full bg-orange-600/10 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
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
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/20"
            >
              Załóż konto — zajmuje 30 sekund →
            </button>
            <button
              onClick={() => { setStep("category"); setCategory(null); setLikedPlaces([]); setGroupReactions({}); setOtherDeviceDone(false); }}
              className="w-full py-3 rounded-2xl border border-border/50 text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
            >
              Spróbuj innej kategorii
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
