import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TemplatePin {
  place_name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
  suggested_time: string;
  duration_minutes: number;
}

interface RouteTemplate {
  id: string;
  city: string;
  personality_type: string;
  title: string;
  tags: string[];
  pins: TemplatePin[];
  photos: [string, string];
  creator_handle: string;
  creator_color: string;
  creator_initials: string;
  point_count: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const KRAKOW_PINS_FULL: TemplatePin[] = [
  { place_name: "Wawel", address: "Wawel 5, 31-001 Kraków", latitude: 50.0543, longitude: 19.9352, category: "monument", description: "Ikoniczny zamek i wzgórze.", suggested_time: "09:00", duration_minutes: 90 },
  { place_name: "Sukiennice", address: "Rynek Główny 1-3, 31-042 Kraków", latitude: 50.0617, longitude: 19.9373, category: "market", description: "Historyczne centrum handlowe.", suggested_time: "11:00", duration_minutes: 45 },
  { place_name: "Kościół Mariacki", address: "pl. Mariacki 5, 31-042 Kraków", latitude: 50.0617, longitude: 19.9390, category: "church", description: "Gotycka bazylika z XIV w.", suggested_time: "11:55", duration_minutes: 30 },
  { place_name: "Kawiarnia Płyś", address: "ul. Szewska 14, 31-009 Kraków", latitude: 50.0619, longitude: 19.9361, category: "cafe", description: "Kultowa kawiarnia Starego Miasta.", suggested_time: "13:00", duration_minutes: 60 },
  { place_name: "MOCAK", address: "ul. Lipowa 4, 30-702 Kraków", latitude: 50.0519, longitude: 19.9601, category: "museum", description: "Muzeum Sztuki Współczesnej.", suggested_time: "14:30", duration_minutes: 90 },
  { place_name: "Kazimierz", address: "ul. Szeroka, 31-053 Kraków", latitude: 50.0517, longitude: 19.9431, category: "walk", description: "Klimatyczna żydowska dzielnica.", suggested_time: "16:30", duration_minutes: 90 },
  { place_name: "Veganico", address: "ul. Józefa 9, 31-056 Kraków", latitude: 50.0510, longitude: 19.9445, category: "restaurant", description: "Wegańska restauracja w Kazimierzu.", suggested_time: "19:00", duration_minutes: 75 },
  { place_name: "Planty", address: "Park Planty, Kraków", latitude: 50.0597, longitude: 19.9375, category: "park", description: "Pierścień zieleni wokół Starego Miasta.", suggested_time: "20:30", duration_minutes: 40 },
  { place_name: "Burger Bar", address: "ul. Szewska 9, 31-009 Kraków", latitude: 50.0622, longitude: 19.9358, category: "restaurant", description: "Kultowy burger bar w centrum.", suggested_time: "21:30", duration_minutes: 60 },
];

const MOCK_TEMPLATES: RouteTemplate[] = [
  {
    id: "mock-maximizer",
    city: "Kraków",
    personality_type: "maximizer",
    title: "Maximizer",
    tags: ["Wawel", "Sukiennice", "Kawiarnia Płyś", "MOCAK", "Veganico", "Kazimierz", "Planty", "Burger bar"],
    pins: KRAKOW_PINS_FULL,
    photos: [
      "https://images.unsplash.com/photo-1519197924294-4ba991a11128?w=300&h=200&fit=crop",
      "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=300&h=200&fit=crop",
    ],
    creator_handle: "@bart",
    creator_color: "#6B4F3A",
    creator_initials: "B",
    point_count: 9,
  },
  {
    id: "mock-flow",
    city: "Kraków",
    personality_type: "flow_seeker",
    title: "Flow seeker",
    tags: ["Wawel", "Sukiennice", "Kawiarnia Płyś", "MOCAK"],
    pins: KRAKOW_PINS_FULL.slice(0, 4),
    photos: [
      "https://images.unsplash.com/photo-1562979314-bee7453e911c?w=300&h=200&fit=crop",
      "https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=300&h=200&fit=crop",
    ],
    creator_handle: "@trasa",
    creator_color: "#f97316",
    creator_initials: "T",
    point_count: 4,
  },
  {
    id: "mock-experience",
    city: "Kraków",
    personality_type: "experience_hunter",
    title: "Experience hunter",
    tags: ["Wawel", "Sukiennice", "Kawiarnia Płyś", "MOCAK", "Veganico", "Kazimierz"],
    pins: KRAKOW_PINS_FULL.slice(0, 7),
    photos: [
      "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=300&h=200&fit=crop",
      "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=300&h=200&fit=crop",
    ],
    creator_handle: "@trasa",
    creator_color: "#f97316",
    creator_initials: "T",
    point_count: 7,
  },
  {
    id: "mock-night",
    city: "Kraków",
    personality_type: "night_owl",
    title: "Night owl",
    tags: ["Kazimierz", "Burger bar", "Kawiarnia Płyś", "Planty"],
    pins: [KRAKOW_PINS_FULL[5], KRAKOW_PINS_FULL[8], KRAKOW_PINS_FULL[3], KRAKOW_PINS_FULL[7]],
    photos: [
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300&h=200&fit=crop",
      "https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?w=300&h=200&fit=crop",
    ],
    creator_handle: "@trasa",
    creator_color: "#f97316",
    creator_initials: "T",
    point_count: 4,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStaticMapUrl = (pins: TemplatePin[]) => {
  if (!pins?.length) return null;
  const markers = pins
    .slice(0, 8)
    .map((p) => `markers=color:black%7C${p.latitude},${p.longitude}`)
    .join("&");
  const center = pins[Math.floor(pins.length / 2)];
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${center.latitude},${center.longitude}&zoom=14&size=400x400&scale=2` +
    `&${markers}&key=${GOOGLE_MAPS_API_KEY}` +
    `&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`
  );
};

const Avatar = ({ color, initials }: { color: string; initials: string }) => (
  <div
    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
    style={{ backgroundColor: color }}
  >
    {initials}
  </div>
);

const Photo = ({ src, index }: { src: string; index: number }) => {
  const gradients = ["from-amber-100 to-orange-200", "from-sky-100 to-blue-200", "from-teal-100 to-emerald-200", "from-violet-100 to-purple-200"];
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={cn("w-full h-full bg-gradient-to-br", gradients[index % gradients.length])} />;
  return <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />;
};

// ─── Component ────────────────────────────────────────────────────────────────
interface TemplateSelectionProps {
  city: string;
  date: Date;
}

const TemplateSelection = ({ city, date }: TemplateSelectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forking, setForking] = useState(false);

  // For cities other than Kraków, no mock templates yet
  const templates = city === "Kraków" ? MOCK_TEMPLATES : [];
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const handleConfirm = async () => {
    if (!selected) return;
    if (!user) { navigate("/auth"); return; }

    setForking(true);
    try {
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          user_id: user.id,
          title: `${selected.title} – ${city}`,
          city,
          start_date: format(date, "yyyy-MM-dd"),
          trip_type: "planning",
          status: "draft",
          day_number: 1,
        })
        .select("id")
        .single();

      if (routeError || !route) throw routeError;

      const pinsToInsert = selected.pins.map((pin, i) => ({
        route_id: route.id,
        place_name: pin.place_name,
        address: pin.address,
        latitude: pin.latitude,
        longitude: pin.longitude,
        category: pin.category,
        description: pin.description,
        suggested_time: pin.suggested_time,
        pin_order: i + 1,
      }));

      const { error: pinsError } = await supabase.from("pins").insert(pinsToInsert);
      if (pinsError) throw pinsError;

      navigate(`/day-plan?id=${route.id}`);
    } catch (err) {
      console.error("Fork error:", err);
      toast.error("Nie udało się utworzyć trasy. Spróbuj ponownie.");
      setForking(false);
    }
  };

  if (!templates.length) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-4 text-center">
        <p className="text-muted-foreground text-sm">
          Brak gotowych plannerów dla {city} – pracujemy nad tym!
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/create", { state: { city, date: date.toISOString() } })}
          className="rounded-full"
        >
          Zaplanuj od zera
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cards list */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-3">
        {templates.map((template, cardIdx) => {
          const isSelected = selectedId === template.id;
          const mapUrl = getStaticMapUrl(template.pins);

          return (
            <button
              key={template.id}
              onClick={() => setSelectedId(isSelected ? null : template.id)}
              className={cn(
                "w-full text-left rounded-2xl border bg-card overflow-hidden transition-all",
                isSelected
                  ? "border-foreground/50 shadow-md ring-2 ring-foreground/10"
                  : "border-border/50"
              )}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-xs text-muted-foreground">
                  {template.city}
                  <span className="mx-1 text-muted-foreground/40">/</span>
                  Polska
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {template.creator_handle}
                  </span>
                  <Avatar color={template.creator_color} initials={template.creator_initials} />
                </div>
              </div>

              {/* Photo grid */}
              <div className="flex h-44 gap-0.5 px-3">
                {/* Left: map */}
                <div className="w-[46%] rounded-l-xl overflow-hidden relative">
                  {mapUrl ? (
                    <img src={mapUrl} alt="Mapa trasy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                </div>
                {/* Right: 2 photos stacked */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex-1 rounded-tr-xl overflow-hidden">
                    <Photo src={template.photos[0]} index={cardIdx * 2} />
                  </div>
                  <div className="flex-1 rounded-br-xl overflow-hidden">
                    <Photo src={template.photos[1]} index={cardIdx * 2 + 1} />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="px-3 pt-2.5 pb-3 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-foreground">{template.title}</span>
                  <span className="text-xs text-muted-foreground">· {template.point_count} punktów</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {template.tags.join(" · ")}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="px-4 pt-2 pb-safe-4 pb-6 space-y-2 border-t border-border/20">
        <Button
          onClick={handleConfirm}
          disabled={!selected || forking}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20 disabled:opacity-40"
        >
          {forking ? <Loader2 className="h-5 w-5 animate-spin" /> : "Dalej"}
        </Button>
        <button
          onClick={() => navigate("/create", { state: { city, date: date.toISOString() } })}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Zaplanuj trasę od zera
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TemplateSelection;
