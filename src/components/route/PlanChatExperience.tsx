import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2, Brain, Plus, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  initialUserMessage?: string;
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

const PLATFORM_BADGE: Record<string, { label: string; className: string }> = {
  instagram: { label: "IG", className: "bg-pink-500 text-white" },
  tiktok:    { label: "TK", className: "bg-black text-white" },
  youtube:   { label: "YT", className: "bg-red-500 text-white" },
};

// ─── Helper components ────────────────────────────────────────────────────────

function CarouselPlanCard({
  pin, index, onClick,
}: { pin: PlanPin; index: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[72vw] max-w-[280px] rounded-2xl overflow-hidden bg-card border border-border/40 active:scale-[0.97] transition-transform text-left snap-start"
    >
      {/* Photo */}
      <div className="w-full h-44 bg-muted relative">
        {pin.photoUrl ? (
          <img src={pin.photoUrl} alt={pin.place_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {CATEGORY_EMOJI[pin.category] ?? "📍"}
          </div>
        )}
        {/* Order badge */}
        <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-foreground/90 text-background flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        {/* Time badge */}
        {pin.suggested_time && (
          <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold">
            {pin.suggested_time}
          </div>
        )}
        {/* Creator platform badge */}
        {pin.creator?.platform && PLATFORM_BADGE[pin.creator.platform] && (
          <div className={cn(
            "absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
            PLATFORM_BADGE[pin.creator.platform].className
          )}>
            {PLATFORM_BADGE[pin.creator.platform].label}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{pin.place_name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {CATEGORY_EMOJI[pin.category]} {CATEGORY_LABEL[pin.category] ?? pin.category}
          {pin.duration_minutes ? ` · ${pin.duration_minutes} min` : ""}
        </p>
      </div>
    </button>
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

// ─── Main component ───────────────────────────────────────────────────────────

function getCurrentTimeContext(): { current_time: string; current_date: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    current_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    current_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

const PlanChatExperience = ({ preferences, onPlanReady, likedPlaces, initialUserMessage }: PlanChatExperienceProps) => {
  const { toast } = useToast();
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
  const [addPinDay, setAddPinDay] = useState<number | null>(null);

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
        const initMsg = initialUserMessage ?? "Generuj plan";
        const response = await supabase.functions.invoke("plan-route", {
          body: {
            preferences,
            messages: isSubsequentDay ? [] : [{ role: "user", content: initMsg }],
            force_plan: isSubsequentDay ? false : true,
            liked_places: likedPlaces,
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
            setPlan(data.plan);
            setMessages([...userMsgEntry, { role: "assistant", content: cleanMessage || fallbackIntro }]);
          } else {
            // Day 2+: only greeting returned, no plan yet — show greeting + skeleton
            setMessages([...userMsgEntry, { role: "assistant", content: cleanMessage || fallbackIntro }]);
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
        body: { preferences, messages: newMessages, current_plan: plan, liked_places: likedPlaces, ...getCurrentTimeContext() },
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
            body: { preferences, messages: apiMessages2, current_plan: plan, force_plan: true, liked_places: likedPlaces, ...getCurrentTimeContext() },
          });
          if (!planResponse.error && planResponse.data?.plan) {
            if (planResponse.data.memory_used) setMemoryUsed(true);
            const { cleanMessage: cm } = parseSuggestions(planResponse.data.message ?? "");
            if (cm) setMessages(prev => [...prev, { role: "assistant", content: cm }]);
            setPlan(planResponse.data.plan);
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

  const handleConfirm = () => {
    if (plan) onPlanReady(plan, messages);
  };

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Przygotowuję rozmowę...</p>
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

          {/* Half / Full: carousel or detail view */}
          {(snap !== "peek" || dragH !== null) && plan && (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {detailPin ? (
                /* ── Detail view (replaces nested sheet) ── */
                <>
                  <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/40">
                    <button
                      onClick={() => { setDetailPin(null); setSnap("half"); }}
                      className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h3 className="text-sm font-semibold truncate flex-1">{detailPin.pin.place_name}</h3>
                    {detailPin.pin.suggested_time && (
                      <span className="text-sm font-semibold tabular-nums">{detailPin.pin.suggested_time}</span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {detailPin.pin.photoUrl && (
                      <img src={detailPin.pin.photoUrl} alt={detailPin.pin.place_name} className="w-full h-52 object-cover" />
                    )}
                    <div className="px-5 py-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                        {detailPin.pin.description && (
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{detailPin.pin.description}</p>
                        )}
                      </div>
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
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-5 pb-6 pt-2 flex gap-2 border-t border-border/40">
                    <button
                      onClick={() => { handleRemovePin(detailPin.dayNumber, detailPin.pinIndex); setDetailPin(null); setSnap("half"); }}
                      className="flex-1 py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium"
                    >
                      Usuń z planu
                    </button>
                    <button
                      onClick={() => { setDetailPin(null); setSnap("half"); }}
                      className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold"
                    >
                      Zamknij
                    </button>
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
                      <div className="flex-1 overflow-y-auto px-4">
                        {plan.days.map((day) => (
                          <div key={day.day_number} className="mb-4">
                            <div className="flex items-center justify-between py-3">
                              <h3 className="text-sm font-semibold text-foreground">
                                {plan.days.length > 1 ? `Dzień ${day.day_number}` : "Plan dnia"}
                              </h3>
                              {day.day_metrics && (
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                                  {day.day_metrics.total_walking_km && (
                                    <span>🚶 {day.day_metrics.total_walking_km} km</span>
                                  )}
                                  {day.day_metrics.crowd_level && (
                                    <span>
                                      {day.day_metrics.crowd_level === "low" ? "🟢" : day.day_metrics.crowd_level === "medium" ? "🟡" : "🔴"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-orange">
                              {day.pins.map((pin, idx) => (
                                <CarouselPlanCard
                                  key={idx}
                                  pin={pin}
                                  index={idx}
                                  onClick={() => { setDetailPin({ pin, dayNumber: day.day_number, pinIndex: idx }); setSnap("full"); }}
                                />
                              ))}
                              <button
                                onClick={() => setAddPinDay(day.day_number)}
                                className="flex-shrink-0 w-[72vw] max-w-[280px] h-[244px] rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors snap-start"
                              >
                                <Plus className="h-5 w-5" />
                                <span className="text-xs">Dodaj miejsce</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-border/40">
                        <button
                          onClick={handleConfirm}
                          className="w-full py-3.5 rounded-xl bg-foreground text-background text-sm font-semibold"
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

      {/* ── Add pin sheet ─────────────────────────────────────────────────── */}
      {addPinDay !== null && (
        <AddPinSheet
          open={addPinDay !== null}
          onOpenChange={(o) => !o && setAddPinDay(null)}
          cityContext={preferences.city}
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
