import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Map } from "lucide-react";
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

interface DbTemplate {
  id: string;
  city: string;
  personality_type: string;
  title: string;
  tags: string[];
  pins: TemplatePin[];
  cover_photos: string[];
  creator_handle: string;
  point_count: number;
  fork_count: number;
}

interface RouteTemplate extends DbTemplate {
  creator_color: string;
  creator_initials: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HANDLE_STYLES: Record<string, { color: string; initials: string }> = {
  "@gastrobesties":     { color: "#e85d04", initials: "G" },
  "@krakow_guide":      { color: "#2d6a4f", initials: "K" },
  "@dziewczynazkrakowa":{ color: "#9d4edd", initials: "D" },
  "@akcent.krakowski":  { color: "#1d3557", initials: "A" },
  "@krakowmypassion":   { color: "#c77dff", initials: "M" },
  "@krakowhello":       { color: "#f4a261", initials: "I" },
  "@trasa":             { color: "#f97316", initials: "T" },
};

const getHandleStyle = (handle: string) =>
  HANDLE_STYLES[handle] ?? { color: "#6b7280", initials: handle.replace("@", "").charAt(0).toUpperCase() };

const enrichTemplate = (t: DbTemplate): RouteTemplate => {
  const style = getHandleStyle(t.creator_handle);
  return { ...t, creator_color: style.color, creator_initials: style.initials };
};

const getStaticMapUrl = (pins: TemplatePin[]) => {
  if (!pins?.length) return null;
  const markers = pins
    .slice(0, 8)
    .map((p) => `markers=color:black%7C${p.latitude},${p.longitude}`)
    .join("&");
  const center = pins[Math.floor(pins.length / 2)];
  const params =
    `center=${center.latitude},${center.longitude}&zoom=14&size=400x400&scale=2` +
    `&${markers}` +
    `&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
  return `/api/static-map?${params}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Avatar = ({ color, initials }: { color: string; initials: string }) => (
  <div
    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
    style={{ backgroundColor: color }}
  >
    {initials}
  </div>
);

const MapCell = ({ url }: { url: string | null }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed)
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Map className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  return <img src={url} alt="Mapa trasy" className="w-full h-full object-cover" onError={() => setFailed(true)} />;
};

const Photo = ({ src, index }: { src: string; index: number }) => {
  const gradients = [
    "from-amber-100 to-orange-200",
    "from-sky-100 to-blue-200",
    "from-teal-100 to-emerald-200",
    "from-violet-100 to-purple-200",
  ];
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return <div className={cn("w-full h-full bg-gradient-to-br", gradients[index % gradients.length])} />;
  return <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />;
};

// ─── Main component ───────────────────────────────────────────────────────────
interface TemplateSelectionProps {
  city: string;
  date: Date;
}

const TemplateSelection = ({ city, date }: TemplateSelectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forking, setForking] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("route_templates")
      .select("*")
      .ilike("city", `%${city}%`)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .then(({ data, error }: { data: DbTemplate[] | null; error: any }) => {
        if (error) console.error("Template fetch error:", error);
        setTemplates((data ?? []).map(enrichTemplate));
        setLoading(false);
      });
  }, [city]);

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

      (supabase as any)
        .from("route_templates")
        .update({ fork_count: selected.fork_count + 1 })
        .eq("id", selected.id)
        .then(() => {});

      // Build RoutePlan from template pins for PlanChatExperience
      const initialPlan = {
        city,
        days: [{ day_number: 1, pins: selected.pins.map(p => ({ ...p, day_number: 1 })) }],
      };

      navigate("/create", {
        state: {
          fromTemplate: true,
          routeId: route.id,
          city,
          date: date.toISOString(),
          initialPlan,
        },
      });
    } catch (err) {
      console.error("Fork error:", err);
      toast.error("Nie udało się utworzyć trasy. Spróbuj ponownie.");
      setForking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-4 text-center">
        <p className="text-muted-foreground text-sm">
          Brak gotowych plannerów dla {city} - pracujemy nad tym!
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
              {/* Header */}
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
                <div className="w-[46%] rounded-l-xl overflow-hidden">
                  <MapCell url={mapUrl} />
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex-1 rounded-tr-xl overflow-hidden">
                    <Photo src={template.cover_photos?.[0]} index={cardIdx * 2} />
                  </div>
                  <div className="flex-1 rounded-br-xl overflow-hidden">
                    <Photo src={template.cover_photos?.[1]} index={cardIdx * 2 + 1} />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="px-3 pt-2.5 pb-3 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-foreground">{template.title}</span>
                  <span className="text-xs text-muted-foreground">· {template.point_count} punktów</span>
                </div>
                {template.tags?.length > 0 && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {template.tags.join(" · ")}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="px-4 pt-2 pb-safe-4 pb-6 space-y-2 border-t border-border/20">
        <Button
          onClick={handleConfirm}
          disabled={!selected || forking}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20 disabled:opacity-40"
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
