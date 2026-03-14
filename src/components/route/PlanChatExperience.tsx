import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2, Brain, Zap, Users, Footprints, Trash2, RefreshCw, Plus, Video, Music, Camera, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { type PlanPin } from "./DayPinList";
import AddPinSheet from "./AddPinSheet";

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

interface PlanChatExperienceProps {
  preferences: TripPreferences;
  onPlanReady: (plan: RoutePlan, messages: TextMessage[]) => void;
  likedPlaces?: string[];
}

type SnapState = "peek" | "half" | "full";

function getSnapPx(snap: SnapState, containerH?: number): number {
  const h = containerH ?? window.innerHeight;
  if (snap === "peek") return 88;
  if (snap === "half") return Math.round(h * 0.52);
  return Math.round(h * 0.80);
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

// ─── Category emoji map ───────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", monument: "🏰",
  walk: "🚶", viewpoint: "🌅", nightlife: "🌙", shopping: "🛍️",
  church: "⛪", gallery: "🖼️", park: "🌿", bar: "🍺", market: "🏪",
};

// ─── Helper components ────────────────────────────────────────────────────────

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

function CreatorIcon({ platform }: { platform: "youtube" | "tiktok" | "instagram" }) {
  if (platform === "youtube") return <Video className="h-3.5 w-3.5 text-red-500" />;
  if (platform === "instagram") return <Camera className="h-3.5 w-3.5 text-pink-500" />;
  return <Music className="h-3.5 w-3.5 text-foreground" />;
}

// Rich always-expanded pin card for the bottom sheet
function PlanRow({
  pin,
  index,
  onRemove,
  onAlternatives,
}: {
  pin: PlanPin;
  index: number;
  onRemove: () => void;
  onAlternatives: () => void;
}) {
  const walkInfo = index > 0 && (pin.walking_time_from_prev || pin.distance_from_prev);
  return (
    <div>
      {walkInfo && (
        <div className="flex items-center gap-1 pl-4 py-1 text-[10px] text-muted-foreground">
          <Footprints className="h-2.5 w-2.5 flex-shrink-0" />
          {pin.walking_time_from_prev && <span>{pin.walking_time_from_prev}</span>}
          {pin.walking_time_from_prev && pin.distance_from_prev && <span>·</span>}
          {pin.distance_from_prev && <span>{pin.distance_from_prev}</span>}
        </div>
      )}
      <div className="py-3 space-y-2.5">
        {/* Top row: photo + header + actions */}
        <div className="flex gap-2.5">
          {pin.photoUrl && (
            <img
              src={pin.photoUrl}
              alt={pin.place_name}
              className="flex-shrink-0 w-[72px] h-[72px] rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">{pin.suggested_time}</span>
                  <span className="text-sm font-semibold leading-tight">{pin.place_name}</span>
                  {pin.duration_minutes && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{pin.duration_minutes}'</span>
                  )}
                </div>
                <span className="text-xl leading-none">{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>
                {pin.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{pin.description}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={onAlternatives}
                  className="h-7 w-7 flex items-center justify-center text-muted-foreground/70 hover:text-foreground rounded transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onRemove}
                  className="h-7 w-7 flex items-center justify-center text-destructive/70 hover:text-destructive rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pros & Cons */}
        {((pin.pros && pin.pros.length > 0) || (pin.cons && pin.cons.length > 0)) && (
          <div className="space-y-0.5 pl-1">
            {pin.pros?.map((pro, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-px">✓</span>
                <span className="text-muted-foreground">{pro}</span>
              </div>
            ))}
            {pin.cons?.map((con, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="text-red-500 flex-shrink-0 mt-px">✗</span>
                <span className="text-muted-foreground">{con}</span>
              </div>
            ))}
          </div>
        )}

        {/* Creator link */}
        {pin.creator && (
          <a
            href={pin.creator.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CreatorIcon platform={pin.creator.platform} />
            <span className="truncate">{pin.creator.name}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
          </a>
        )}
      </div>
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

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

// ─── Main component ───────────────────────────────────────────────────────────

const PlanChatExperience = ({ preferences, onPlanReady, likedPlaces }: PlanChatExperienceProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [preparingPlan, setPreparingPlan] = useState(false);
  const [addPinDay, setAddPinDay] = useState<number | null>(null);
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);

  // Sheet snap state
  const [snap, setSnap] = useState<SnapState>("half");
  const [dragH, setDragH] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  // Alternatives state
  const [alternativesFor, setAlternativesFor] = useState<{ pin: PlanPin; dayNumber: number; pinIndex: number } | null>(null);
  const [alternatives, setAlternatives] = useState<PlanPin[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<(text?: string) => void>(() => {});
  const chatContainerRef = useRef<HTMLDivElement>(null);
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

  // Initialize: Day 1 → immediate real plan; Day 2+ → greeting referencing previous day
  useEffect(() => {
    const initialize = async () => {
      const nDays = preferences.numDays;
      const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;
      const fallbackIntro = `Oto wstępny plan na **${daysLabel} w ${preferences.city}** 🗺️\n\nPowiedz co zmienić!`;

      // Day 2+: send empty messages so server generates personalized greeting
      // referencing previous day's AAR feedback before producing the plan.
      // Day 1: force plan immediately.
      const isSubsequentDay = (preferences.dayNumber ?? 1) > 1;

      try {
        const response = await supabase.functions.invoke("plan-route", {
          body: {
            preferences,
            messages: isSubsequentDay ? [] : [{ role: "user", content: "Generuj plan" }],
            force_plan: isSubsequentDay ? false : true,
            liked_places: likedPlaces,
          },
        });

        if (!response.error) {
          const data = response.data;
          const { cleanMessage } = parseSuggestions(data?.message ?? "");
          if (data?.memory_used) setMemoryUsed(true);

          if (data?.plan) {
            setPlan(data.plan);
            setMessages([{ role: "assistant", content: cleanMessage || fallbackIntro }]);
          } else {
            // Day 2+: only greeting returned, no plan yet — show greeting + skeleton
            setMessages([{ role: "assistant", content: cleanMessage || fallbackIntro }]);
            setPlan(buildMockPlan(nDays)); // placeholder until user confirms
          }
        } else {
          console.error("plan-route error:", response.error);
          toast({ title: "Błąd generowania planu", description: String(response.error), variant: "destructive" });
          setPlan(buildMockPlan(nDays));
          setMessages([{ role: "assistant", content: fallbackIntro }]);
        }
      } catch (err) {
        console.error("plan-route init failed:", err);
        toast({ title: "Błąd inicjalizacji", description: String(err), variant: "destructive" });
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
        body: { preferences, messages: newMessages, current_plan: plan, liked_places: likedPlaces },
      });

      if (response.error) throw new Error(response.error.message);
      const data = response.data;

      const { cleanMessage: parsedMsg } = parseSuggestions(data.message ?? "");
      if (data.memory_used) setMemoryUsed(true);

      if (parsedMsg) {
        setMessages(prev => [...prev, { role: "assistant", content: parsedMsg }]);
      }

      if (data.plan) {
        setPlan(data.plan);
        setSelectedDay(prev => data.plan.days.some((d: any) => d.day_number === prev) ? prev : 1);
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
            body: { preferences, messages: apiMessages2, current_plan: plan, force_plan: true, liked_places: likedPlaces },
          });
          if (!planResponse.error && planResponse.data?.plan) {
            if (planResponse.data.memory_used) setMemoryUsed(true);
            const { cleanMessage: cm } = parseSuggestions(planResponse.data.message ?? "");
            if (cm) setMessages(prev => [...prev, { role: "assistant", content: cm }]);
            setPlan(planResponse.data.plan);
                setSelectedDay(1);
            setSnap("half");
          }
        } catch (planErr) {
          console.error("Force plan error:", planErr);
        }
        setPreparingPlan(false);
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

  // ─── Plan mutation handlers ───────────────────────────────────────────────────

  const handleRemovePin = (dayNumber: number, pinIndex: number) => {
    if (!plan) return;
    setPlan({ ...plan, days: plan.days.map(d => d.day_number === dayNumber ? { ...d, pins: d.pins.filter((_, i) => i !== pinIndex) } : d) });
  };

  const handleAddPinToDay = (pin: PlanPin) => {
    if (!plan || addPinDay === null) return;
    setPlan({ ...plan, days: plan.days.map(d => d.day_number === addPinDay ? { ...d, pins: [...d.pins, { ...pin, day_number: addPinDay }] } : d) });
    setAddPinDay(null);
  };

  const handleConfirm = () => {
    if (plan) onPlanReady(plan, messages);
  };

  const handleGetAlternatives = useCallback(async (pin: PlanPin, dayNumber: number, pinIndex: number) => {
    setAlternativesFor({ pin, dayNumber, pinIndex });
    setAlternatives([]);
    setLoadingAlternatives(true);
    try {
      const response = await supabase.functions.invoke("get-alternatives", {
        body: { place_name: pin.place_name, category: pin.category, city: plan?.city ?? "", latitude: pin.latitude, longitude: pin.longitude },
      });
      if (!response.error && response.data?.alternatives) setAlternatives(response.data.alternatives);
    } catch { /* ignore */ }
    setLoadingAlternatives(false);
  }, [plan]);

  const handleSelectAlternative = useCallback((altPin: PlanPin) => {
    if (!alternativesFor || !plan) return;
    const { dayNumber, pinIndex, pin: original } = alternativesFor;
    setPlan({
      ...plan,
      days: plan.days.map(d =>
        d.day_number === dayNumber
          ? { ...d, pins: d.pins.map((p, i) => i === pinIndex ? { ...altPin, suggested_time: original.suggested_time, duration_minutes: original.duration_minutes, day_number: dayNumber } : p) }
          : d
      ),
    });
    setAlternativesFor(null);
  }, [alternativesFor, plan]);

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Przygotowuję rozmowę...</p>
      </div>
    );
  }

  const activeDay = plan?.days.find(d => d.day_number === selectedDay);

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
                ? msg.content.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
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

        {/* ── Draggable bottom sheet ──────────────────────────────────────── */}
        <div
          style={{
            height: `${sheetHeight}px`,
            transition: dragH !== null ? "none" : "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/60 rounded-t-3xl flex flex-col overflow-hidden z-10"
        >
          {/* Drag handle */}
          <div
            className="flex-shrink-0 flex justify-center items-center py-4 cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: "none" }}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onClick={() => {
              if (dragH !== null) return;
              setSnap(s => s === "peek" ? "half" : s === "half" ? "full" : "peek");
            }}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
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

          {/* Half / Full: full plan view */}
          {(snap !== "peek" || dragH !== null) && plan && (
            <>
              {/* Day tabs */}
              <div className="flex-shrink-0 flex gap-1.5 px-4 pb-2 pt-1">
                {plan.days.map(d => (
                  <button
                    key={d.day_number}
                    onClick={() => setSelectedDay(d.day_number)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      selectedDay === d.day_number
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {plan.days.length > 1 ? `Dzień ${d.day_number}` : "Plan dnia"}
                    <span className="ml-1 opacity-60">· {d.pins.length}</span>
                  </button>
                ))}
              </div>

              {/* Scrollable plan content */}
              <div className="flex-1 overflow-y-auto min-h-0 px-4">
                {/* Memory banner */}
                {memoryUsed && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-muted/60 border border-border/40">
                    <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[12px] text-muted-foreground">Plan uwzględnia Twoje wcześniejsze preferencje</span>
                  </div>
                )}

                {/* Day metrics */}
                {activeDay?.day_metrics && (
                  <div className="flex items-center gap-3 px-1 mb-2 text-[11px] text-muted-foreground">
                    {activeDay.day_metrics.total_walking_km != null && (
                      <span className="flex items-center gap-1">
                        <Footprints className="h-3 w-3" />
                        {activeDay.day_metrics.total_walking_km} km
                      </span>
                    )}
                    {activeDay.day_metrics.crowd_level && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {activeDay.day_metrics.crowd_level === "low" ? "spokojnie" : activeDay.day_metrics.crowd_level === "medium" ? "umiarkowanie" : "tłoczno"}
                      </span>
                    )}
                    {activeDay.day_metrics.energy_cost && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {activeDay.day_metrics.energy_cost === "low" ? "relaks" : activeDay.day_metrics.energy_cost === "medium" ? "aktywnie" : "intensywnie"}
                      </span>
                    )}
                  </div>
                )}

                {/* Plan rows or skeleton */}
                {preparingPlan ? (
                  <PlanSkeleton numDays={1} />
                ) : (
                  <div className="divide-y divide-border/50">
                    {(activeDay?.pins ?? []).map((pin, idx) => (
                      <PlanRow
                        key={idx}
                        pin={pin}
                        index={idx}
                        onRemove={() => handleRemovePin(selectedDay, idx)}
                        onAlternatives={() => handleGetAlternatives(pin, selectedDay, idx)}
                      />
                    ))}
                  </div>
                )}

                {/* Add pin */}
                {!preparingPlan && (
                  <button
                    onClick={() => setAddPinDay(selectedDay)}
                    className="flex items-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj miejsce
                  </button>
                )}

                {/* CTA — sticky at bottom of scroll area */}
                {!preparingPlan && (
                  <div className="sticky bottom-0 bg-card pt-2 pb-4">
                    <button
                      onClick={handleConfirm}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Wybieram ten plan!
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sticky input area ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border/40 bg-background px-3 pt-2 pb-safe">
          <div className="flex items-end gap-2 max-w-lg mx-auto">
          {hasVoiceSupport && (
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                listening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Chcesz coś zmienić?"
              rows={1}
              disabled={loading}
              className="w-full resize-none rounded-xl border border-border/60 bg-card px-4 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
          </div>
          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 h-10 w-10 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Drawers & Sheets ──────────────────────────────────────────────── */}
      <AddPinSheet
        open={addPinDay !== null}
        onOpenChange={(open) => !open && setAddPinDay(null)}
        onPinAdd={handleAddPinToDay}
        cityContext={plan?.city || ""}
      />

      <Sheet open={!!alternativesFor} onOpenChange={(open) => !open && setAlternativesFor(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Alternatywy dla: {alternativesFor?.pin.place_name}</SheetTitle>
          </SheetHeader>
          {loadingAlternatives ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alternatives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nie znaleziono alternatyw w tej okolicy.</p>
          ) : (
            <div className="space-y-2 pb-4">
              {alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectAlternative(alt)}
                  className="w-full text-left p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors"
                >
                  <p className="text-sm font-medium">{alt.place_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{alt.address}</p>
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlanChatExperience;
