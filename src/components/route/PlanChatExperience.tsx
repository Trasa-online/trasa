import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Brain, Plus, ExternalLink, ArrowLeft, Star, ChevronDown, ChevronUp, Map as MapIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type PlanPin } from "./DayPinList";
import AddPinSheet from "./AddPinSheet";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

interface DayMetrics {
  total_walking_km?: number;
  crowd_level?: "low" | "medium" | "high";
  energy_cost?: "low" | "medium" | "high";
}

interface RoutePlan {
  city: string;
  days: {
    day_number: number;
    day_metrics?: DayMetrics;
    pins: PlanPin[];
  }[];
}

interface TripPreferences {
  numDays: number;
  pace: string;
  priorities: string[];
  startDate: string | null;
  planningMode: string;
  city: string;
  folderId?: string;
  dayNumber?: number;
}

interface AltRoute {
  id: string;
  title: string;
  personality_type: string;
}

interface PlanChatExperienceProps {
  preferences: TripPreferences;
  onPlanReady: (plan: RoutePlan, messages: TextMessage[]) => void;
  likedPlaces?: string[];
  likedPlacesData?: { place_name: string; category: string; description: string; latitude?: number; longitude?: number }[];
  skippedPlaces?: string[];
  idealDay?: string;
  initialUserMessage?: string;
  initialPlan?: RoutePlan;
  altRoutes?: AltRoute[];
  altIndex?: number;
  onSwitchAlt?: (i: number) => void;
}

type SnapState = "peek" | "half" | "full";

function getSnapPx(snap: SnapState, containerH?: number): number {
  const h = containerH ?? window.innerHeight;
  if (snap === "peek") return 80;
  if (snap === "half") return Math.round(h * 0.62);
  return Math.round(h * 0.82);
}

// ─── Mock plan data for Kraków ────────────────────────────────────────────────

type MockPin = Omit<PlanPin, "day_number">;

const MOCK_PINS_DAY1: MockPin[] = [
  { place_name: "Wzgórze Wawelskie", address: "Wawel 5, 31-001 Kraków", description: "Symboliczne serce Krakowa — zamek, katedra i panorama Wisły.", suggested_time: "10:00", duration_minutes: 90, category: "monument", latitude: 50.0542, longitude: 19.9354, walking_time_from_prev: null, distance_from_prev: null, photoUrl: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=200&q=70", pros: ["Idź wcześnie rano — brak tłumów", "Wstęp na dziedziniec gratis"], cons: ["Muzea drogie w sezonie"], creator: { platform: "youtube", name: "Zwiedzamy Polskę", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Kazimierz", address: "ul. Szeroka, 31-053 Kraków", description: "Klimatyczna żydowska dzielnica pełna kawiarni i galerii.", suggested_time: "11:50", duration_minutes: 60, category: "walk", latitude: 50.0493, longitude: 19.9451, walking_time_from_prev: "20 min", distance_from_prev: "1.5 km", photoUrl: "https://images.unsplash.com/photo-1559521783-1d1599583485?w=200&q=70", pros: ["Klimatyczne uliczki", "Dużo street food"], cons: ["Ruchliwie w weekendy"], creator: { platform: "instagram", name: "krakow.travel", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Mleczarnia", address: "ul. Meiselsa 20, 31-058 Kraków", description: "Kultowa knajpka na Kazimierzu — śledzie, bigos i wnętrze jak z PRL.", suggested_time: "13:00", duration_minutes: 75, category: "restaurant", latitude: 50.0500, longitude: 19.9462, walking_time_from_prev: "8 min", distance_from_prev: "600 m", photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&q=70", pros: ["Autentyczna atmosfera PRL", "Przystępne ceny"], cons: ["Może być kolejka"], creator: { platform: "tiktok", name: "jedzempolske", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Rynek Główny", address: "Rynek Główny, 31-042 Kraków", description: "Największy rynek Europy Środkowej — Sukiennice, Kościół Mariacki, hejnał.", suggested_time: "14:30", duration_minutes: 60, category: "monument", latitude: 50.0617, longitude: 19.9373, walking_time_from_prev: "20 min", distance_from_prev: "1.5 km", photoUrl: "https://images.unsplash.com/photo-1569880153113-76e33fc52d5f?w=200&q=70", pros: ["Obowiązkowy punkt w Krakowie", "Hejnał o każdej pełnej godzinie"], cons: ["Bardzo turystycznie — drogie restauracje dookoła"], creator: { platform: "youtube", name: "Poland Travel Guide", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Cafe Camelot", address: "ul. Tomasza 17, 31-027 Kraków", description: "Legendarna krakowska kawiarnia — lody z bitą śmietaną i spokojna atmosfera.", suggested_time: "15:45", duration_minutes: 45, category: "cafe", latitude: 50.0639, longitude: 19.9357, walking_time_from_prev: "8 min", distance_from_prev: "600 m", photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&q=70", pros: ["Najlepsza kawa w Starym Mieście", "Klimatyczne wnętrza"], cons: ["Małe, łatwo brak miejsca"], creator: { platform: "instagram", name: "cafecrawl.pl", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Restauracja Miód Malina", address: "ul. Grodzka 40, 31-044 Kraków", description: "Polska kuchnia w sercu Starego Miasta — żurek, pierogi, bigos.", suggested_time: "19:00", duration_minutes: 90, category: "restaurant", latitude: 50.0579, longitude: 19.9386, walking_time_from_prev: "12 min", distance_from_prev: "900 m", photoUrl: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200&q=70", pros: ["Klasyczna polska kuchnia", "Dobra lokalizacja"], cons: ["Rezerwacja wskazana"], creator: { platform: "youtube", name: "Foodie w Polsce", thumbnailUrl: "", postUrl: "#" } },
];

const MOCK_PINS_DAY2: MockPin[] = [
  { place_name: "Fabryka Schindlera", address: "ul. Lipowa 4, 30-702 Kraków", description: "Muzeum historii Krakowa podczas II WŚ — zarezerwuj bilet wcześniej.", suggested_time: "10:00", duration_minutes: 120, category: "museum", latitude: 50.0447, longitude: 19.9440, walking_time_from_prev: null, distance_from_prev: null, photoUrl: "https://images.unsplash.com/photo-1569338389880-f154ef1d5e14?w=200&q=70", pros: ["Poruszające muzeum", "Oryginalne wnętrza fabryki"], cons: ["Kup bilet online — wyprzedane z tygodniowym wyprzedzeniem"], creator: { platform: "youtube", name: "Historia Polska", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Plac Bohaterów Getta", address: "Plac Bohaterów Getta, 30-543 Kraków", description: "Puste krzesła upamiętniające krakowskie getto — chwila refleksji.", suggested_time: "12:30", duration_minutes: 30, category: "monument", latitude: 50.0468, longitude: 19.9467, walking_time_from_prev: "8 min", distance_from_prev: "600 m", photoUrl: "https://images.unsplash.com/photo-1580974928064-f0aeef70895a?w=200&q=70", pros: ["Wzruszające miejsce pamięci", "Wstęp wolny"], cons: ["Emocjonalnie obciążające — zaplanuj czas na refleksję"] },
  { place_name: "Lunch w Podgórzu", address: "ul. Zabłocie, 30-701 Kraków", description: "Modna dzielnica z galeriami i świetnymi restauracjami na lunch.", suggested_time: "13:15", duration_minutes: 75, category: "restaurant", latitude: 50.0455, longitude: 19.9491, walking_time_from_prev: "5 min", distance_from_prev: "400 m", photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200&q=70", pros: ["Nieturystyczna dzielnica", "Świeże koncepty gastronomiczne"], cons: ["Mniej opcji niż w centrum"], creator: { platform: "instagram", name: "podgorze.eats", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Muzeum Narodowe w Krakowie", address: "al. 3 Maja 1, 30-062 Kraków", description: "Najważniejsze muzeum sztuki polskiej — od średniowiecza po współczesność.", suggested_time: "15:00", duration_minutes: 120, category: "museum", latitude: 50.0591, longitude: 19.9248, walking_time_from_prev: "30 min", distance_from_prev: "2.2 km", photoUrl: "https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=200&q=70", pros: ["Bogata kolekcja sztuki", "Wtorek — wstęp bezpłatny"], cons: ["Duże — zaplanuj selektywne zwiedzanie"], creator: { platform: "youtube", name: "Art w Polsce", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Kolacja przy Plantach", address: "ul. Krupnicza 20, 31-123 Kraków", description: "Wieczór w modnej części miasta pełnej restauracji i barów.", suggested_time: "19:30", duration_minutes: 90, category: "restaurant", latitude: 50.0636, longitude: 19.9307, walking_time_from_prev: "15 min", distance_from_prev: "1.1 km", photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&q=70", pros: ["Duży wybór restauracji", "Spacer po Plantach gratis"], cons: ["Popularny obszar — możliwe kolejki"] },
];

const MOCK_PINS_DAY3: MockPin[] = [
  { place_name: "Nowa Huta", address: "al. Róż 1, 31-621 Kraków", description: "Zaplanowane miasto z epoki stalinizmu — architektura jak z ZSRR.", suggested_time: "10:00", duration_minutes: 120, category: "walk", latitude: 50.0681, longitude: 20.0487, walking_time_from_prev: null, distance_from_prev: null, photoUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=200&q=70", pros: ["Unikalne socrealistyczne klimaty", "Prawie brak turystów"], cons: ["Daleko od centrum — jedź tramwajem"], creator: { platform: "tiktok", name: "urbex.polska", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Lunch w Nowej Hucie", address: "os. Centrum A, 31-901 Kraków", description: "Nieturystyczna restauracja w sercu socjalistycznej dzielnicy.", suggested_time: "12:30", duration_minutes: 75, category: "restaurant", latitude: 50.0683, longitude: 20.0471, walking_time_from_prev: "5 min", distance_from_prev: "400 m", photoUrl: "https://images.unsplash.com/photo-1559304822-9eb2f8b9d7b5?w=200&q=70", pros: ["Autentyczna, nieturystyczna kuchnia", "Bardzo przystępne ceny"], cons: ["Ograniczony wybór opcji wegetariańskich"] },
  { place_name: "Bulwary Wiślane", address: "Bulwar Czerwieński, Kraków", description: "Spacer wzdłuż Wisły pod Wawelem — złota godzina i tratwy z barami.", suggested_time: "16:00", duration_minutes: 75, category: "walk", latitude: 50.0510, longitude: 19.9320, walking_time_from_prev: "30 min (tramwaj)", distance_from_prev: "8 km", photoUrl: "https://images.unsplash.com/photo-1568555890773-b4a26c44b77c?w=200&q=70", pros: ["Najpiękniejszy widok na Wawel", "Tratwy z barami latem"], cons: ["Tłoczno w ciepłe weekendy"], creator: { platform: "instagram", name: "krakow.sunsets", thumbnailUrl: "", postUrl: "#" } },
  { place_name: "Kolacja — pożegnanie z Krakowem", address: "ul. Poselska 24, 31-002 Kraków", description: "Ostatnia kolacja z widokiem na Wawel — wspomnienia do zabrania ze sobą.", suggested_time: "19:30", duration_minutes: 90, category: "restaurant", latitude: 50.0563, longitude: 19.9388, walking_time_from_prev: "12 min", distance_from_prev: "900 m", photoUrl: "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=200&q=70", pros: ["Romantyczna atmosfera", "Widok na Wawel z tarasu"], cons: ["Wymagana rezerwacja z wyprzedzeniem"], creator: { platform: "youtube", name: "Kraków Vlog", thumbnailUrl: "", postUrl: "#" } },
];

const ALL_MOCK_DAYS = [MOCK_PINS_DAY1, MOCK_PINS_DAY2, MOCK_PINS_DAY3];

function buildMockPlan(numDays: number): RoutePlan {
  return {
    city: "Kraków",
    days: Array.from({ length: Math.min(numDays, 3) }, (_, i) => ({
      day_number: i + 1,
      day_metrics: { total_walking_km: 7 + i, crowd_level: "medium" as const, energy_cost: "medium" as const },
      pins: (ALL_MOCK_DAYS[i] ?? MOCK_PINS_DAY1).map(p => ({ ...p, day_number: i + 1 })),
    })),
  };
}


function parseSuggestions(message: string): { cleanMessage: string; suggestions: string[] } {
  const match = message.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
  if (!match) return { cleanMessage: message, suggestions: [] };
  try {
    const suggestions = JSON.parse(match[1]);
    return {
      cleanMessage: message.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "").trim(),
      suggestions: Array.isArray(suggestions) ? suggestions : [],
    };
  } catch {
    return { cleanMessage: message.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "").trim(), suggestions: [] };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  viewpoint: "🔭", shopping: "🛍️", nightlife: "🎶", monument: "🏰",
  church: "⛪", market: "🏪", bar: "🍺", gallery: "🖼️", walk: "🚶",
};

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  viewpoint: "Widok", shopping: "Zakupy", nightlife: "Nocne życie",
  monument: "Zabytek", church: "Kościół", market: "Targ", bar: "Bar",
  gallery: "Galeria", walk: "Spacer",
};

const CATEGORY_BG: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-600",
  cafe: "bg-amber-100 text-amber-700",
  museum: "bg-purple-100 text-purple-600",
  park: "bg-green-100 text-green-600",
  viewpoint: "bg-sky-100 text-sky-600",
  shopping: "bg-pink-100 text-pink-600",
  nightlife: "bg-indigo-100 text-indigo-600",
  monument: "bg-stone-100 text-stone-600",
  church: "bg-yellow-100 text-yellow-700",
  market: "bg-lime-100 text-lime-700",
  bar: "bg-rose-100 text-rose-600",
  gallery: "bg-fuchsia-100 text-fuchsia-600",
  walk: "bg-teal-100 text-teal-600",
};

const PLATFORM_BADGE: Record<string, { label: string; className: string }> = {
  instagram: { label: "IG", className: "bg-pink-500 text-white" },
  tiktok:    { label: "TK", className: "bg-black text-white" },
  youtube:   { label: "YT", className: "bg-red-500 text-white" },
};

// ─── Helper components ────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#e85d04","#2d6a4f","#9d4edd","#1d3557","#c77dff","#f4a261","#f97316","#0096c7"];
function nameColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function CreatorAvatar({ name, thumbnailUrl, zIndex, size = 7 }: { name: string; thumbnailUrl?: string; zIndex?: number; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.replace(/^@/, "").charAt(0).toUpperCase() : "?";
  const cls = `h-${size} w-${size} rounded-full border-2 border-card overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold`;
  return (
    <div className={cls} style={{ zIndex, backgroundColor: nameColor(name) }}>
      {thumbnailUrl && !failed
        ? <img src={thumbnailUrl} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : initials
      }
    </div>
  );
}

function PostThumbnail({ post }: { post: { thumbnail_url: string; creator_name: string; post_url: string } }) {
  const [failed, setFailed] = useState(false);
  return (
    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-24 rounded-xl overflow-hidden relative block">
      {post.thumbnail_url && !failed
        ? <img src={post.thumbnail_url} alt={post.creator_name} className="w-24 h-24 object-cover" onError={() => setFailed(true)} />
        : <div className="w-24 h-24 flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: nameColor(post.creator_name) }}>{post.creator_name.charAt(0).toUpperCase()}</div>
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <p className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-medium truncate">@{post.creator_name}</p>
    </a>
  );
}

function LargeCarouselCard({
  pin, index, dayLabel, onClick, onMoveUp, onMoveDown, isFirst, isLast,
}: { pin: PlanPin; index: number; dayLabel?: string; onClick: () => void; onMoveUp?: () => void; onMoveDown?: () => void; isFirst?: boolean; isLast?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [fetchedPhoto, setFetchedPhoto] = useState<string | null>(pin.photoUrl ?? null);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (fetchedPhoto || !GOOGLE_MAPS_API_KEY) return;
    supabase.functions
      .invoke("google-places-proxy", {
        body: { placeName: pin.place_name, latitude: pin.latitude || undefined, longitude: pin.longitude || undefined },
      })
      .then(({ data }) => {
        const ref = data?.result?.photos?.[0]?.photo_reference;
        if (ref) setFetchedPhoto(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_MAPS_API_KEY}`);
      })
      .catch(() => {});
  }, [pin.place_name]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dt = Date.now() - pointerStart.current.t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    pointerStart.current = null;
    // Tap: small movement + short press
    if (dist < 12 && dt < 400) { onClick(); return; }
    // Swipe down: downward gesture
    if (dy > 40 && Math.abs(dy) > Math.abs(dx) * 1.4) { onClick(); return; }
    // Horizontal swipe → card navigation, do nothing
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="flex-shrink-0 w-[80vw] h-full rounded-2xl overflow-hidden bg-card border border-border/40 snap-center flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none"
    >
      {/* Hero image — 62% of card height */}
      <div className="relative flex-[62] min-h-0">
        {fetchedPhoto && !imgFailed ? (
          <img src={fetchedPhoto} alt={pin.place_name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900">
            {CATEGORY_EMOJI[pin.category] ?? "📍"}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
        {/* Number + day label */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs font-bold backdrop-blur-sm">
            {index + 1}
          </div>
          {dayLabel && (
            <span className="text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">{dayLabel}</span>
          )}
        </div>
        {/* Reorder arrows — same row as number, right edge */}
        {(onMoveUp || onMoveDown) && (
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={isFirst}
              className="h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center disabled:opacity-25 active:bg-black/80 transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5 text-white" />
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={isLast}
              className="h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center disabled:opacity-25 active:bg-black/80 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        )}
        {/* Creator avatars — below reorder row */}
        {(pin.creators?.length ?? 0) > 0 && (
          <div className="absolute top-12 right-3 flex -space-x-1.5">
            {pin.creators!.slice(0, 3).map((c, i) => (
              <CreatorAvatar key={i} name={c.name} thumbnailUrl={c.thumbnailUrl} zIndex={10 - i} />
            ))}
            {pin.creators!.length > 3 && (
              <div className="h-7 w-7 rounded-full border-2 border-card bg-black/50 text-white flex items-center justify-center text-[9px] font-bold" style={{ zIndex: 7 }}>
                +{pin.creators!.length - 3}
              </div>
            )}
          </div>
        )}
        {/* Swipe-down hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-60">
          <ChevronDown className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Info — 38% */}
      <div className="flex-[38] min-h-0 px-3.5 py-3 flex items-stretch gap-2">
        {/* Left: text content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full self-start">
            {CATEGORY_EMOJI[pin.category]} {CATEGORY_LABEL[pin.category] ?? pin.category}
          </span>
          <p className="text-sm font-bold leading-tight line-clamp-2 text-foreground">{pin.place_name}</p>
          {pin.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{pin.description}</p>
          )}
          {pin.walking_time_from_prev && (
            <p className="text-[11px] text-muted-foreground/60 mt-auto">🚶 {pin.walking_time_from_prev}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanSkeleton({ numDays }: { numDays: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: numDays }).map((_, di) => (
        <div key={di} className="space-y-3">
          <Skeleton className="h-4 w-28 rounded-full" />
          {Array.from({ length: 4 }).map((_, pi) => (
            <div key={pi} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </div>
              <Skeleton className="h-3 w-10 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderBubble(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

async function enrichPlanWithInstagram(plan: RoutePlan, city: string, sb: typeof supabase): Promise<RoutePlan> {
  try {
    // Step 1: scraped_places enrichment (optional — graceful if empty)
    const { data: scraped } = await sb
      .from("scraped_places")
      .select("place_name, thumbnail_url, post_url, creator_name, source_platform, description")
      .ilike("city", `%${city}%`);

    const pool = (scraped ?? []).filter(sp => sp.post_url);

    function pinKeywords(pinName: string): string[] {
      return pinName.toLowerCase().split(/[\s,.\-/()]+/)
        .filter(w => w.length >= 4)
        .filter(w => !["lunch", "dinner", "kolacja", "obiad", "przy", "restaurant"].includes(w));
    }

    function findMatches(pinName: string) {
      if (!pool.length) return [];
      const keywords = pinKeywords(pinName);
      if (!keywords.length) return [];
      return pool.filter(sp => keywords.some(kw => (sp.description ?? "").toLowerCase().includes(kw)));
    }

    let rrIdx = 0;
    const instagramEnriched: RoutePlan = {
      ...plan,
      days: plan.days.map(day => ({
        ...day,
        pins: day.pins.map(pin => {
          let matches = findMatches(pin.place_name);
          if (matches.length < 2 && pool.length > 0) {
            const extras: typeof pool = [];
            for (let i = 0; i < 2 && extras.length < 2 - matches.length; i++) {
              const candidate = pool[(rrIdx + i) % pool.length];
              if (!matches.includes(candidate)) extras.push(candidate);
            }
            rrIdx = (rrIdx + 2) % pool.length;
            matches = [...matches, ...extras];
          }
          if (!matches.length) return pin;
          const creators = matches.slice(0, 5).map(m => ({
            platform: (m.source_platform ?? "instagram") as "instagram" | "tiktok" | "youtube",
            name: m.creator_name ?? "",
            thumbnailUrl: m.thumbnail_url ?? "",
            postUrl: m.post_url ?? "",
            description: m.description ?? undefined,
          }));
          return { ...pin, creator: creators[0], creators };
        }),
      })),
    };

    // Fetch Google Places photos for all pins without a photoUrl
    const allPins = instagramEnriched.days.flatMap(d => d.pins);
    const needsPhoto = allPins.filter(p => !p.photoUrl && p.latitude && p.longitude);
    if (needsPhoto.length > 0) {
      const results = await Promise.allSettled(
        needsPhoto.map(pin =>
          sb.functions.invoke("google-places-proxy", {
            body: { placeName: pin.place_name, latitude: pin.latitude, longitude: pin.longitude },
          }).then(({ data }) => {
            const photoRef = data?.result?.photos?.[0]?.photo_reference;
            return {
              place_name: pin.place_name,
              photoUrl: photoRef
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`
                : null,
            };
          })
        )
      );
      const photoMap = new Map<string, string>();
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.photoUrl) {
          photoMap.set(r.value.place_name, r.value.photoUrl);
        }
      }
      return {
        ...instagramEnriched,
        days: instagramEnriched.days.map(day => ({
          ...day,
          pins: day.pins.map(pin => ({
            ...pin,
            photoUrl: pin.photoUrl || photoMap.get(pin.place_name) || undefined,
          })),
        })),
      };
    }

    return instagramEnriched;
  } catch { return plan; }
}

// ─── Main component ───────────────────────────────────────────────────────────

function getCurrentTimeContext(): { current_time: string; current_date: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    current_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    current_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

const PlanChatExperience = ({ preferences, onPlanReady, likedPlaces, likedPlacesData, skippedPlaces, idealDay, initialUserMessage, initialPlan, altRoutes, altIndex, onSwitchAlt }: PlanChatExperienceProps) => {
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [preparingPlan, setPreparingPlan] = useState(false);
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [detailPin, setDetailPin] = useState<{
    pin: PlanPin; dayNumber: number; pinIndex: number;
  } | null>(null);
  const [detailExtra, setDetailExtra] = useState<{
    photoUrl: string | null;
    rating: number | null;
    ratingsTotal: number | null;
    scrapedPosts: { thumbnail_url: string; creator_name: string; post_url: string; description: string }[];
  } | null>(null);
  const [addPinDay, setAddPinDay] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showSwapOptions, setShowSwapOptions] = useState(false);
  const [swapCandidates, setSwapCandidates] = useState<{ place_name: string; category: string; description: string; suggested_time: string | null; walking_time?: string | null }[]>([]);

  // Fetch enriched swap candidates when swap panel opens
  useEffect(() => {
    if (!showSwapOptions || !likedPlaces?.length || !plan) return;
    const inPlanNames = new Set(plan.days.flatMap(d => d.pins).map(p => p.place_name.toLowerCase()));
    const candidateNames = likedPlaces.filter(n => !inPlanNames.has(n.toLowerCase()));
    if (!candidateNames.length) { setSwapCandidates([]); return; }

    const calcWalkingTime = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const mins = Math.round(dist / 5 * 60);
      return `~${mins} min`;
    };
    const fromPin = detailPin?.pin;

    // Use pre-loaded swipe data if available (avoids DB lookup)
    if (likedPlacesData?.length) {
      const dataMap = new Map(likedPlacesData.map(p => [p.place_name.toLowerCase(), p]));
      setSwapCandidates(candidateNames.map(n => {
        const d = dataMap.get(n.toLowerCase());
        if (!d) return { place_name: n, category: "", description: "", suggested_time: null, walking_time: null };
        const walking_time = (fromPin && fromPin.latitude && fromPin.longitude && d.latitude && d.longitude)
          ? calcWalkingTime(fromPin.latitude, fromPin.longitude, d.latitude, d.longitude)
          : null;
        return { place_name: d.place_name, category: d.category, description: d.description, suggested_time: null, walking_time };
      }));
      return;
    }

    // Fallback: query DB
    (supabase as any)
      .from("places")
      .select("place_name, category, description, suggested_time, latitude, longitude")
      .ilike("city", plan.city)
      .in("place_name", candidateNames)
      .then(({ data }: { data: any[] | null }) => {
        if (!data?.length) {
          setSwapCandidates(candidateNames.map(n => ({ place_name: n, category: "", description: "", suggested_time: null, walking_time: null })));
          return;
        }
        const placeMap = new Map(data.map((p: any) => [p.place_name.toLowerCase(), p]));
        setSwapCandidates(candidateNames.map(n => {
          const p = placeMap.get(n.toLowerCase());
          if (!p) return { place_name: n, category: "", description: "", suggested_time: null, walking_time: null };
          const walking_time = (fromPin && fromPin.latitude && fromPin.longitude && p.latitude && p.longitude)
            ? calcWalkingTime(fromPin.latitude, fromPin.longitude, p.latitude, p.longitude)
            : null;
          return { ...p, walking_time };
        }));
      });
  }, [showSwapOptions, likedPlaces, likedPlacesData, plan, detailPin]);

  // Sheet snap state
  const [snap, setSnap] = useState<SnapState>("half");
  const [dragH, setDragH] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<(text?: string) => void>(() => {});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const savedCarouselScroll = useRef<number>(0);
  const [containerH, setContainerH] = useState(0);

  // Measure the real height of the chat+sheet container so the sheet never overflows into the input
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    setContainerH(el.offsetHeight);
    const ro = new ResizeObserver(() => setContainerH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sheetHeight = dragH ?? getSnapPx(snap, containerH || undefined);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch Google Places details + scraped Instagram posts when a pin is opened
  useEffect(() => {
    if (!detailPin) { setDetailExtra(null); return; }
    setDetailExtra(null);
    const { pin } = detailPin;
    const city = preferences.city || "";

    const fetchDetailData = async () => {
      // Google Places: photo + rating
      let photoUrl: string | null = pin.photoUrl ?? null;
      let rating: number | null = null;
      let ratingsTotal: number | null = null;

      if (pin.latitude && pin.longitude) {
        try {
          const { data } = await supabase.functions.invoke("google-places-proxy", {
            body: { placeName: pin.place_name, latitude: pin.latitude, longitude: pin.longitude },
          });
          const result = data?.result;
          if (result) {
            const photoRef = result.photos?.[0]?.photo_reference;
            if (photoRef) {
              photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
            }
            rating = result.rating ?? null;
            ratingsTotal = result.user_ratings_total ?? null;
          }
        } catch { /* keep defaults */ }
      }

      // scraped_places: match by caption (description) containing pin name keywords
      const keywords = pin.place_name
        .toLowerCase().split(/[\s,.\-/()]+/).filter(w => w.length >= 4);
      let scrapedPosts: { thumbnail_url: string; creator_name: string; post_url: string; description: string }[] = [];
      // First try from already-enriched creators on the pin
      if (pin.creators?.length) {
        scrapedPosts = pin.creators
          .filter(c => c.thumbnailUrl)
          .map(c => ({ thumbnail_url: c.thumbnailUrl, creator_name: c.name, post_url: c.postUrl, description: c.description ?? "" }));
      }
      // If no creators on pin, fetch from DB
      if (!scrapedPosts.length && keywords.length > 0) {
        try {
          const { data } = await supabase
            .from("scraped_places")
            .select("thumbnail_url, creator_name, post_url, description")
            .ilike("city", `%${city}%`)
            .not("thumbnail_url", "is", null)
            .limit(200);
          if (data) {
            scrapedPosts = data
              .filter(sp => {
                const desc = (sp.description ?? "").toLowerCase();
                return keywords.some(kw => desc.includes(kw));
              })
              .slice(0, 6) as { thumbnail_url: string; creator_name: string; post_url: string; description: string }[];
          }
        } catch { /* ignore */ }
      }

      setDetailExtra({ photoUrl, rating, ratingsTotal, scrapedPosts });
    };

    fetchDetailData();
  }, [detailPin?.pin.place_name]);

  // Initialize: if initialPlan provided (template fork) → skip AI; else generate
  useEffect(() => {
    if (initialPlan) {
      enrichPlanWithInstagram(initialPlan, preferences.city || "", supabase).then(enriched => setPlan(enriched));
      setMessages([{ role: "assistant", content: `Oto Twój plan w **${preferences.city}** 🗺️\n\nMogę go dostosować do Twoich potrzeb — powiedz co zmienić!` }]);
      setInitializing(false);
      return;
    }
    const initialize = async () => {
      const nDays = preferences.numDays;
      const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;
      const fallbackIntro = `Oto wstępny plan na **${daysLabel} w ${preferences.city}** 🗺️\n\nPowiedz co zmienić!`;

      // Day 2+: send empty messages so server generates personalized greeting
      // referencing previous day's AAR feedback before producing the plan.
      // Day 1: force plan immediately.
      const isSubsequentDay = (preferences.dayNumber ?? 1) > 1;

      try {
        const initMsg = initialUserMessage ?? "Generuj plan";
        const response = await supabase.functions.invoke("plan-route", {
          body: {
            preferences,
            messages: isSubsequentDay ? [] : [{ role: "user", content: initMsg }],
            force_plan: isSubsequentDay ? false : true,
            liked_places: likedPlaces,
            skipped_places: skippedPlaces?.length ? skippedPlaces : undefined,
            ideal_day: idealDay || undefined,
            ...getCurrentTimeContext(),
          },
        });

        if (!response.error) {
          const data = response.data;
          const { cleanMessage } = parseSuggestions(data?.message ?? "");
          if (data?.memory_used) setMemoryUsed(true);

          // If user came via orb overlay, show their message first in the chat
          const userMsgEntry: TextMessage[] =
            initialUserMessage && !isSubsequentDay
              ? [{ role: "user", content: initialUserMessage }]
              : [];

          if (data?.plan) {
            enrichPlanWithInstagram(data.plan, preferences.city || "", supabase).then(enriched => setPlan(enriched));
            setMessages([...userMsgEntry, { role: "assistant", content: cleanMessage || fallbackIntro }]);
          } else {
            // Day 2+: only greeting returned, no plan yet — show greeting + skeleton
            setMessages([...userMsgEntry, { role: "assistant", content: cleanMessage || fallbackIntro }]);
            setPlan(buildMockPlan(nDays)); // placeholder until user confirms
          }
        } else {
          console.error("plan-route error:", response.error);
          toast.error("Błąd generowania planu", { description: String(response.error) });
          setPlan(buildMockPlan(nDays));
          setMessages([{ role: "assistant", content: fallbackIntro }]);
        }
      } catch (err) {
        console.error("plan-route init failed:", err);
        toast.error("Błąd inicjalizacji", { description: String(err) });
        setPlan(buildMockPlan(nDays));
        setMessages([{ role: "assistant", content: fallbackIntro }]);
      } finally {
        setInitializing(false);
      }
    };
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragStartH.current = dragH ?? getSnapPx(snap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!e.buttons) return;
    const delta = dragStartY.current - e.clientY;
    const newH = Math.max(60, Math.min(getSnapPx("full", containerH || undefined) + 40, dragStartH.current + delta));
    setDragH(newH);
  };

  const handleDragEnd = () => {
    const h = dragH ?? getSnapPx(snap);
    const nearest = (["peek", "half", "full"] as SnapState[])
      .sort((a, b) => Math.abs(getSnapPx(a, containerH || undefined) - h) - Math.abs(getSnapPx(b, containerH || undefined) - h))[0];
    setSnap(nearest);
    setDragH(null);
  };

  // ─── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const newMessages: TextMessage[] = [...messages, { role: "user", content: msgText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("plan-route", {
        body: { preferences, messages: newMessages, current_plan: plan, liked_places: likedPlaces, skipped_places: skippedPlaces?.length ? skippedPlaces : undefined, ideal_day: idealDay || undefined, ...getCurrentTimeContext() },
      });

      if (response.error) throw new Error(response.error.message);
      const data = response.data;

      const { cleanMessage: parsedMsg } = parseSuggestions(data.message ?? "");
      if (data.memory_used) setMemoryUsed(true);

      if (parsedMsg) {
        setMessages(prev => [...prev, { role: "assistant", content: parsedMsg }]);
      }

      if (data.plan) {
        enrichPlanWithInstagram(data.plan, preferences.city || "", supabase).then(enriched => setPlan(enriched));
        setSnap("half"); // show updated plan
        setLoading(false);
      } else if (data.preparing_plan) {
        setLoading(false);
        setPreparingPlan(true);
        const apiMessages2 = parsedMsg
          ? [...newMessages, { role: "assistant" as const, content: parsedMsg }]
          : newMessages;
        try {
          const planResponse = await supabase.functions.invoke("plan-route", {
            body: { preferences, messages: apiMessages2, current_plan: plan, force_plan: true, liked_places: likedPlaces, skipped_places: skippedPlaces?.length ? skippedPlaces : undefined, ...getCurrentTimeContext() },
          });
          if (!planResponse.error && planResponse.data?.plan) {
            if (planResponse.data.memory_used) setMemoryUsed(true);
            const { cleanMessage: cm } = parseSuggestions(planResponse.data.message ?? "");
            if (cm) setMessages(prev => [...prev, { role: "assistant", content: cm }]);
            enrichPlanWithInstagram(planResponse.data.plan, preferences.city || "", supabase).then(enriched => setPlan(enriched));
            setSnap("half");
          }
        } catch (planErr) {
          console.error("Force plan error:", planErr);
        }
        setPreparingPlan(false);
      } else if (plan && !data.plan) {
        // AI gave text but no updated plan — check if it promised a change and force the plan
        const editKeywords = ["zamien", "zamień", "dodaj", "usuń", "usun", "zmien", "zmień", "aktualizuj", "usunął", "dodałem", "zamieniłem", "oto zaktualizowany", "plan po zmianach", "nowa wersja"];
        const msgLower = (parsedMsg ?? "").toLowerCase();
        const seemsLikeEdit = editKeywords.some(k => msgLower.includes(k));
        if (seemsLikeEdit) {
          setPreparingPlan(true);
          const apiMessages2 = parsedMsg
            ? [...newMessages, { role: "assistant" as const, content: parsedMsg }]
            : newMessages;
          try {
            const planResponse = await supabase.functions.invoke("plan-route", {
              body: { preferences, messages: apiMessages2, current_plan: plan, force_plan: true, liked_places: likedPlaces, skipped_places: skippedPlaces?.length ? skippedPlaces : undefined, ...getCurrentTimeContext() },
            });
            if (!planResponse.error && planResponse.data?.plan) {
              enrichPlanWithInstagram(planResponse.data.plan, preferences.city || "", supabase).then(enriched => setPlan(enriched));
              setSnap("half");
            }
          } catch (planErr) {
            console.error("Force plan fallback error:", planErr);
          }
          setPreparingPlan(false);
        } else {
          setSnap("peek");
        }
        setLoading(false);
      } else {
        // Text only — snap to peek so chat is visible
        setSnap("peek");
        setLoading(false);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Przepraszam, coś poszło nie tak. Spróbuj ponownie." }]);
      setSnap("peek");
      setLoading(false);
    }
  }, [input, messages, loading, preferences, plan]);

  // Keep ref in sync so voice callbacks always call the latest sendMessage
  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) setTimeout(() => sendMessageRef.current(transcript), 300);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleRemovePin = (dayNumber: number, pinIndex: number) => {
    setPlan(prev => prev ? {
      ...prev,
      days: prev.days.map(d =>
        d.day_number === dayNumber
          ? { ...d, pins: d.pins.filter((_, i) => i !== pinIndex) }
          : d
      ),
    } : prev);
  };

  const handleMovePin = (dayNumber: number, pinIndex: number, direction: "up" | "down") => {
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d => {
          if (d.day_number !== dayNumber) return d;
          const pins = [...d.pins];
          const swapWith = direction === "up" ? pinIndex - 1 : pinIndex + 1;
          if (swapWith < 0 || swapWith >= pins.length) return d;
          [pins[pinIndex], pins[swapWith]] = [pins[swapWith], pins[pinIndex]];
          return { ...d, pins };
        }),
      };
    });
    setDetailPin(prev => prev ? { ...prev, pinIndex: direction === "up" ? pinIndex - 1 : pinIndex + 1 } : prev);
  };

  const handleConfirm = () => {
    if (plan) onPlanReady(plan, messages);
  };

  if (initializing) {
    // Total loop: 3.6s — lines draw in sequentially, dots pop in, brief hold, then resets
    const LOOP = 3.6;
    const lines = [
      { x1: 30, y1: 90, x2: 75,  y2: 40, len: 70, start: 0    },
      { x1: 75, y1: 40, x2: 120, y2: 70, len: 60, start: 0.22 },
      { x1: 120,y1: 70, x2: 160, y2: 30, len: 60, start: 0.44 },
    ];
    const dots = [
      { cx: 30,  cy: 90, start: 0    },
      { cx: 75,  cy: 40, start: 0.22 },
      { cx: 120, cy: 70, start: 0.44 },
      { cx: 160, cy: 30, start: 0.66 },
    ];
    // Each segment draws over 25% of total loop, holds until 83%, fades out by 97%
    const lineStyle = (start: number, len: number) => ({
      strokeDasharray: len,
      strokeDashoffset: len,
      animation: `lineLoop${Math.round(start*100)} ${LOOP}s ease-in-out infinite`,
    });
    const dotStyle = (start: number) => ({
      opacity: 0,
      animation: `dotLoop ${LOOP}s ease-in-out ${start * LOOP}s infinite`,
    });

    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-8">
        <style>{`
          @keyframes lineLoop0 {
            0%          { stroke-dashoffset: 70; opacity: 0; }
            4%          { opacity: 1; }
            25%         { stroke-dashoffset: 0; }
            83%         { stroke-dashoffset: 0; opacity: 1; }
            97%, 100%   { stroke-dashoffset: 70; opacity: 0; }
          }
          @keyframes lineLoop22 {
            0%, 22%     { stroke-dashoffset: 60; opacity: 0; }
            26%         { opacity: 1; }
            47%         { stroke-dashoffset: 0; }
            83%         { stroke-dashoffset: 0; opacity: 1; }
            97%, 100%   { stroke-dashoffset: 60; opacity: 0; }
          }
          @keyframes lineLoop44 {
            0%, 44%     { stroke-dashoffset: 60; opacity: 0; }
            48%         { opacity: 1; }
            69%         { stroke-dashoffset: 0; }
            83%         { stroke-dashoffset: 0; opacity: 1; }
            97%, 100%   { stroke-dashoffset: 60; opacity: 0; }
          }
          @keyframes dotLoop {
            0%          { opacity: 0; transform: scale(0); transform-box: fill-box; transform-origin: center; }
            8%          { opacity: 1; transform: scale(1.25); transform-box: fill-box; transform-origin: center; }
            18%, 83%    { opacity: 1; transform: scale(1);   transform-box: fill-box; transform-origin: center; }
            97%, 100%   { opacity: 0; transform: scale(0);   transform-box: fill-box; transform-origin: center; }
          }
        `}</style>

        <svg width="200" height="120" viewBox="0 0 200 120" fill="none" className="overflow-visible">
          {lines.map((l, i) => (
            <line key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              className="text-border"
              style={lineStyle(l.start, l.len)}
            />
          ))}
          {dots.map((d, i) => (
            <g key={i}>
              <circle cx={d.cx} cy={d.cy} r="10" fill="currentColor" className="text-muted/30" style={dotStyle(d.start)} />
              <circle cx={d.cx} cy={d.cy} r="5"  fill="currentColor" className="text-foreground" style={dotStyle(d.start)} />
            </g>
          ))}
        </svg>

        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-foreground">Tworzę Twoją trasę</p>
          <p className="text-sm text-muted-foreground leading-relaxed">Ty się zrelaksuj, trasowiczu!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Chat area + Bottom sheet ─────────────────────────────────────── */}
      <div ref={chatContainerRef} className="flex-1 relative min-h-0">

        {/* Chat messages (absolute fill, padded bottom for sheet) */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto"
          style={{ paddingBottom: `${sheetHeight + 12}px` }}
        >
          <div className="px-4 pt-4 space-y-4">
            {messages.map((msg, i) => {
              const bubbles = msg.role === "assistant"
                ? msg.content.split(/\n\n+/).map(s => s.trim()).filter(s => s && !s.startsWith("<suggestions>"))
                : [msg.content];
              return (
                <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                  {bubbles.map((bubble, j) => (
                    <div
                      key={j}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                        msg.role === "user"
                          ? "bg-foreground text-background rounded-br-md"
                          : "bg-card text-foreground rounded-bl-md"
                      )}
                    >
                      {msg.role === "assistant" ? renderBubble(bubble) : bubble}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Typing indicator */}
            {loading && !preparingPlan && (
              <div className="flex justify-start">
                <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Map overlay ─────────────────────────────────────────────────── */}
        {showMap && plan && (() => {
          const allPins = plan.days.flatMap(d => d.pins).filter(p => p.latitude && p.longitude);
          const mapsAppUrl = allPins.length > 0
            ? `https://www.google.com/maps/dir/${allPins.map(p => `${p.latitude},${p.longitude}`).join("/")}`
            : "";
          const pinsJson = JSON.stringify(allPins.map((p, i) => ({
            lat: p.latitude, lng: p.longitude,
            name: p.place_name, time: p.suggested_time || "", index: i + 1,
          })));
          const leafletHtml = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;overflow:hidden}
#map{height:100vh;width:100%}
.pm{background:#f97316;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:-apple-system,sans-serif;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.leaflet-popup-content{margin:10px 14px}
.pn{font-size:13px;font-weight:600;font-family:-apple-system,sans-serif}
.pt{font-size:11px;color:#888;margin-top:2px;font-family:-apple-system,sans-serif}
</style></head><body><div id="map"></div>
<script>
const pins=${pinsJson};
const map=L.map('map',{zoomControl:true,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
const coords=pins.map(p=>[p.lat,p.lng]);
if(coords.length>1)L.polyline(coords,{color:'#f97316',weight:3,opacity:.6,dashArray:'7 5'}).addTo(map);
pins.forEach(p=>{
  const icon=L.divIcon({className:'',html:'<div class="pm">'+p.index+'</div>',iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-18]});
  L.marker([p.lat,p.lng],{icon}).bindPopup('<div class="pn">'+p.name+'</div>'+(p.time?'<div class="pt">'+p.time+'</div>':'')).addTo(map);
});
if(coords.length>1)map.fitBounds(coords,{padding:[50,50]});
else if(coords.length===1)map.setView(coords[0],15);
<\/script></body></html>`;
          return (
            <div className="absolute inset-0 bg-background z-30 flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
                <button onClick={() => setShowMap(false)} className="h-8 w-8 flex items-center justify-center">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="font-semibold flex-1">Trasa na mapie</h2>
                {mapsAppUrl && (
                  <a href={mapsAppUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-orange-500 font-medium flex items-center gap-1">
                    Otwórz <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex-1 relative">
                {allPins.length > 0 ? (
                  <iframe
                    srcDoc={leafletHtml}
                    className="absolute inset-0 w-full h-full border-0"
                    sandbox="allow-scripts"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Brak danych mapy</div>
                )}
              </div>
              <div className="shrink-0 px-4 py-3 border-t border-border/40 space-y-1.5 max-h-44 overflow-y-auto">
                {allPins.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-5 w-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </div>
                    <span className="font-medium truncate flex-1">{p.place_name}</span>
                    {p.suggested_time && <span className="text-muted-foreground text-xs shrink-0">{p.suggested_time}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Draggable bottom sheet ──────────────────────────────────────── */}
        <div
          style={{
            height: `${sheetHeight}px`,
            transition: dragH !== null ? "none" : "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/60 rounded-t-3xl flex flex-col overflow-hidden z-10"
        >
          {/* Drag handle */}
          <div className="flex-shrink-0 relative flex justify-center items-center py-4 select-none">
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              onClick={() => {
                if (dragH !== null) return;
                setSnap(s => s === "peek" ? "half" : s === "half" ? "full" : "peek");
              }}
            />
            <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
            {altRoutes && altRoutes.length > 1 && onSwitchAlt && altIndex !== undefined && (
              <div className="absolute right-3 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onSwitchAlt(altIndex > 0 ? altIndex - 1 : altRoutes.length - 1)}
                  className="h-7 w-7 rounded-full border border-border bg-background flex items-center justify-center active:scale-90 transition-transform"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                  {altIndex + 1}/{altRoutes.length}
                </span>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onSwitchAlt(altIndex < altRoutes.length - 1 ? altIndex + 1 : 0)}
                  className="h-7 w-7 rounded-full border border-border bg-background flex items-center justify-center active:scale-90 transition-transform"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Peek: summary pills */}
          {snap === "peek" && dragH === null && plan && (
            <div className="flex-1 flex items-center gap-3 px-5 overflow-hidden min-w-0">
              {plan.days.map(d => (
                <div key={d.day_number} className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <span className="font-medium text-foreground">Dz.{d.day_number}</span>
                  <span>·</span>
                  <span>{d.pins.length} miejsc</span>
                </div>
              ))}
              <span className="ml-auto text-xs text-muted-foreground/50 flex-shrink-0">↑ plan</span>
            </div>
          )}

          {/* Half / Full: carousel or detail view */}
          {(snap !== "peek" || dragH !== null) && plan && (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {detailPin ? (
                /* ── Detail view ── */
                <>
                  <div className="flex-1 overflow-y-auto">
                    {/* Hero image with gradient overlay */}
                    <div className="relative w-full h-56 bg-muted flex-shrink-0">
                      {detailExtra === null ? (
                        <div className="w-full h-full bg-muted animate-pulse" />
                      ) : detailExtra.photoUrl ? (
                        <img src={detailExtra.photoUrl} alt={detailPin.pin.place_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-200" />
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      {/* Back button */}
                      <button
                        onClick={() => {
                          setDetailPin(null);
                          setDetailExtra(null);
                          setShowSwapOptions(false);
                          setSnap("half");
                          requestAnimationFrame(() => {
                            if (carouselRef.current) carouselRef.current.scrollLeft = savedCarouselScroll.current;
                          });
                        }}
                        className="absolute top-3 left-3 h-9 w-9 rounded-full bg-black/70 flex items-center justify-center text-white ring-1 ring-white/30"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      {/* Place name + time overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                        <h3 className="text-lg font-bold text-white leading-tight">{detailPin.pin.place_name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          {detailPin.pin.suggested_time && (
                            <span className="text-sm font-semibold text-white/90">{detailPin.pin.suggested_time}</span>
                          )}
                          {detailExtra?.rating && (
                            <span className="flex items-center gap-1 text-sm text-white/90">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              {detailExtra.rating.toFixed(1)}
                              {detailExtra.ratingsTotal && (
                                <span className="text-white/60 text-xs">({detailExtra.ratingsTotal.toLocaleString()})</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {/* Category + duration */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {detailPin.pin.category && (
                          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                            {CATEGORY_EMOJI[detailPin.pin.category]} {CATEGORY_LABEL[detailPin.pin.category] ?? detailPin.pin.category}
                          </span>
                        )}
                        {detailPin.pin.duration_minutes && (
                          <span className="text-xs text-muted-foreground">{detailPin.pin.duration_minutes} min</span>
                        )}
                        {detailPin.pin.walking_time_from_prev && (
                          <span className="text-xs text-muted-foreground">· {detailPin.pin.walking_time_from_prev} od poprzedniego</span>
                        )}
                      </div>

                      {/* Description */}
                      {detailPin.pin.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{detailPin.pin.description}</p>
                      )}

                      {/* Mini map */}
                      {detailPin.pin.latitude && detailPin.pin.longitude && (
                        <div className="rounded-2xl overflow-hidden h-32 w-full bg-muted">
                          <img
                            src={`https://maps.googleapis.com/maps/api/staticmap?center=${detailPin.pin.latitude},${detailPin.pin.longitude}&zoom=16&size=600x240&scale=2&markers=color:black%7C${detailPin.pin.latitude},${detailPin.pin.longitude}&key=${GOOGLE_MAPS_API_KEY}&style=feature:poi%7Cvisibility:off`}
                            alt="Mapa"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Influencer recommendations from scraped_places */}
                      {(detailExtra?.scrapedPosts?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">Polecane przez twórców</p>
                          {/* Thumbnails row */}
                          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
                            {detailExtra!.scrapedPosts.map((post, i) => (
                              <PostThumbnail key={i} post={post} />
                            ))}
                          </div>
                          {/* First influencer's quote/description */}
                          {detailExtra!.scrapedPosts[0]?.description && (
                            <div className="mt-3 p-3 rounded-2xl bg-muted/60">
                              <p className="text-xs font-semibold text-foreground/60 mb-1">@{detailExtra!.scrapedPosts[0].creator_name} poleca</p>
                              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
                                {detailExtra!.scrapedPosts[0].description}
                              </p>
                              <a
                                href={detailExtra!.scrapedPosts[0].post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Zobacz post <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pros */}
                      {(detailPin.pin.pros?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/60 mb-1.5">Dlaczego warto</p>
                          <ul className="space-y-1">
                            {detailPin.pin.pros!.map((p, i) => (
                              <li key={i} className="text-sm flex gap-2"><span className="text-green-500">✓</span>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Cons */}
                      {(detailPin.pin.cons?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/60 mb-1.5">Warto wiedzieć</p>
                          <ul className="space-y-1">
                            {detailPin.pin.cons!.map((c, i) => (
                              <li key={i} className="text-sm flex gap-2"><span className="text-yellow-500">!</span>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Creator (from AI enrichment) */}
                      {detailPin.pin.creator && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">Poleca</p>
                          <a
                            href={detailPin.pin.creator.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors"
                          >
                            {detailPin.pin.creator.thumbnailUrl ? (
                              <img src={detailPin.pin.creator.thumbnailUrl} alt={detailPin.pin.creator.name} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                                PLATFORM_BADGE[detailPin.pin.creator.platform]?.className ?? "bg-muted-foreground/20 text-foreground"
                              )}>
                                {PLATFORM_BADGE[detailPin.pin.creator.platform]?.label ?? "?"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{detailPin.pin.creator.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{detailPin.pin.creator.platform} · Zobacz post</p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </a>
                        </div>
                      )}

                      {/* Spacer for bottom buttons */}
                      <div className="h-4" />
                    </div>
                  </div>

                  <div className="flex-shrink-0 border-t border-border/40">
                    {showSwapOptions ? (() => {
                      return (
                        <div className="px-5 pt-3 pb-6">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-foreground">Zamień na…</p>
                            <button onClick={() => setShowSwapOptions(false)} className="text-xs text-muted-foreground">Anuluj</button>
                          </div>
                          {swapCandidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Brak innych wybranych miejsc</p>
                          ) : (
                            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                              {swapCandidates.map(place => (
                                <button
                                  key={place.place_name}
                                  onClick={() => {
                                    const old = detailPin.pin.place_name;
                                    setDetailPin(null);
                                    setDetailExtra(null);
                                    setShowSwapOptions(false);
                                    setSnap("half");
                                    requestAnimationFrame(() => {
                                      if (carouselRef.current) carouselRef.current.scrollLeft = savedCarouselScroll.current;
                                    });
                                    sendMessage(`Zamień ${old} na ${place.place_name}`);
                                  }}
                                  className="text-left w-full px-3 py-3 rounded-xl bg-muted active:scale-[0.97] transition-transform flex items-start gap-3"
                                >
                                  {/* Category icon circle */}
                                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${CATEGORY_BG[place.category] ?? "bg-muted-foreground/10 text-muted-foreground"}`}>
                                    {CATEGORY_EMOJI[place.category] ?? "📍"}
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-sm font-semibold text-foreground leading-tight">{place.place_name}</span>
                                      {place.suggested_time && (
                                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{place.suggested_time}</span>
                                      )}
                                    </div>
                                    {place.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{place.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      {place.category && (
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_BG[place.category] ?? "bg-muted-foreground/10 text-muted-foreground"}`}>
                                          {CATEGORY_LABEL[place.category] ?? place.category}
                                        </span>
                                      )}
                                      {place.walking_time && (
                                        <span className="text-[10px] text-muted-foreground">🚶 {place.walking_time} spaceru</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="px-5 pb-6 pt-2 space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { handleRemovePin(detailPin.dayNumber, detailPin.pinIndex); setDetailPin(null); setDetailExtra(null); setShowSwapOptions(false); setSnap("half"); }}
                            className="flex-1 py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium"
                          >
                            Usuń
                          </button>
                          {(likedPlaces?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setShowSwapOptions(true)}
                              className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-medium"
                            >
                              Zamień
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDetailPin(null);
                              setDetailExtra(null);
                              setShowSwapOptions(false);
                              setSnap("half");
                              requestAnimationFrame(() => {
                                if (carouselRef.current) carouselRef.current.scrollLeft = savedCarouselScroll.current;
                              });
                            }}
                            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold"
                          >
                            Zamknij
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Carousel view ── */
                <>
                  {memoryUsed && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 flex-shrink-0">
                      <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-muted-foreground">Plan uwzględnia Twoje wcześniejsze preferencje</span>
                    </div>
                  )}
                  {preparingPlan ? (
                    <div className="px-4 py-3 overflow-y-auto flex-1">
                      <PlanSkeleton numDays={preferences.numDays} />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                      {/* Alt route switcher pills */}
                      {altRoutes && altRoutes.length > 1 && onSwitchAlt && altIndex !== undefined && (
                        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none flex-shrink-0">
                          {altRoutes.map((r, i) => {
                            const active = i === altIndex;
                            return (
                              <button
                                key={r.id}
                                onClick={() => onSwitchAlt(i)}
                                className={cn(
                                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                  active
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {r.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Large card carousel — fills available height */}
                      <div className="flex-1 min-h-0 overflow-hidden py-2">
                        <div ref={carouselRef} className="h-full flex gap-3 overflow-x-auto px-[10vw] snap-x snap-mandatory scrollbar-none">
                          {plan.days.flatMap((day) =>
                            day.pins.map((pin, idx) => (
                              <LargeCarouselCard
                                key={`${day.day_number}-${pin.place_name}`}
                                pin={pin}
                                index={idx}
                                dayLabel={plan.days.length > 1 ? `Dzień ${day.day_number}` : undefined}
                                onClick={() => { savedCarouselScroll.current = carouselRef.current?.scrollLeft ?? 0; setDetailPin({ pin, dayNumber: day.day_number, pinIndex: idx }); setSnap("full"); }}
                                onMoveUp={idx > 0 ? () => handleMovePin(day.day_number, idx, "up") : undefined}
                                onMoveDown={idx < day.pins.length - 1 ? () => handleMovePin(day.day_number, idx, "down") : undefined}
                                isFirst={idx === 0}
                                isLast={idx === day.pins.length - 1}
                              />
                            ))
                          )}
                          {/* Add pin button — same height as cards */}
                          <button
                            onClick={() => setAddPinDay(plan.days[plan.days.length - 1].day_number)}
                            className="flex-shrink-0 w-[80vw] h-full rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 text-muted-foreground snap-center"
                          >
                            <Plus className="h-6 w-6" />
                            <span className="text-sm">Dodaj miejsce</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex-shrink-0 px-4 pb-4 pt-1 border-t border-border/40 flex gap-2">
                        <button
                          onClick={() => setShowMap(true)}
                          className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground shrink-0"
                        >
                          <MapIcon className="h-4 w-4" />
                          Mapa
                        </button>
                        <button
                          onClick={handleConfirm}
                          className="flex-1 py-3.5 rounded-xl bg-foreground text-background text-sm font-semibold"
                        >
                          Wybieram ten plan!
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky input area ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border/40 bg-background px-3 pt-2 min-h-[56px]" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}>
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          {hasVoiceSupport && (
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                listening ? "bg-destructive text-destructive-foreground animate-pulse" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <div className="flex-1 relative flex items-center">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Chcesz coś zmienić?"
              rows={1}
              disabled={loading}
              className="w-full resize-none rounded-2xl border border-border/60 bg-card px-4 py-2.5 pr-12 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
              style={{ maxHeight: "100px" }}
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-xl flex-shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Add pin sheet ─────────────────────────────────────────────────── */}
      {addPinDay !== null && (
        <AddPinSheet
          open={addPinDay !== null}
          onOpenChange={(o) => !o && setAddPinDay(null)}
          cityContext={preferences.city}
          likedPlaces={likedPlaces}
          existingPinNames={plan?.days.flatMap(d => d.pins).map(p => p.place_name)}
          onPinAdd={(pin) => {
            setPlan(prev => prev ? {
              ...prev,
              days: prev.days.map(d =>
                d.day_number === addPinDay
                  ? { ...d, pins: [...d.pins, { ...pin, day_number: addPinDay }] }
                  : d
              ),
            } : prev);
            setAddPinDay(null);
          }}
        />
      )}

    </div>
  );
};

export default PlanChatExperience;
