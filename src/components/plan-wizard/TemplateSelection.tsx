import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
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
  cover_photos: string[];
  creator_handle: string;
  point_count: number;
}

const personalityLabels: Record<string, string> = {
  maximizer: "Maximizer",
  flow_seeker: "Flow seeker",
  experience_hunter: "Experience hunter",
};

const getStaticMapUrl = (pins: TemplatePin[]) => {
  if (!pins?.length) return null;
  const markers = pins
    .slice(0, 8)
    .map((p) => `markers=color:black|${p.latitude},${p.longitude}`)
    .join("&");
  const center = pins[Math.floor(pins.length / 2)];
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center.latitude},${center.longitude}&zoom=14&size=400x400&scale=2&${markers}&key=${GOOGLE_MAPS_API_KEY}&style=feature:poi|visibility:off&style=feature:transit|visibility:off`;
};

const GradientPlaceholder = ({ index }: { index: number }) => {
  const gradients = [
    "from-orange-100 to-amber-200",
    "from-blue-100 to-sky-200",
    "from-emerald-100 to-teal-200",
    "from-violet-100 to-purple-200",
  ];
  return (
    <div className={cn("w-full h-full bg-gradient-to-br", gradients[index % gradients.length])} />
  );
};

interface TemplateSelectionProps {
  city: string;
  date: Date;
}

const TemplateSelection = ({ city, date }: TemplateSelectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [forkingId, setForkingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("route_templates")
      .select("*")
      .ilike("city", `%${city}%`)
      .eq("is_active", true)
      .then(({ data }) => {
        setTemplates((data as RouteTemplate[]) || []);
        setLoading(false);
      });
  }, [city]);

  const handleFork = async (template: RouteTemplate) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setForkingId(template.id);
    try {
      // Create route
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          user_id: user.id,
          title: `${template.title} – ${city}`,
          city,
          start_date: format(date, "yyyy-MM-dd"),
          trip_type: "planning",
          status: "draft",
          day_number: 1,
        })
        .select("id")
        .single();

      if (routeError || !route) throw routeError;

      // Insert pins
      const pinsToInsert = template.pins.map((pin, i) => ({
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

      // Increment fork count (fire and forget)
      supabase
        .from("route_templates")
        .update({ fork_count: template.fork_count + 1 })
        .eq("id", template.id)
        .then(() => {});

      navigate(`/day-plan?id=${route.id}`);
    } catch (err) {
      console.error("Fork error:", err);
      toast.error("Nie udało się utworzyć trasy. Spróbuj ponownie.");
      setForkingId(null);
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
          Brak szablonów dla {city} – pracujemy nad tym!
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
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-4">
        {templates.map((template) => {
          const mapUrl = getStaticMapUrl(template.pins);
          const isForking = forkingId === template.id;

          return (
            <button
              key={template.id}
              onClick={() => handleFork(template)}
              disabled={!!forkingId}
              className="w-full text-left rounded-2xl border border-border/60 bg-card overflow-hidden active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {/* Photo grid */}
              <div className="flex h-40 gap-0.5">
                {/* Left: map */}
                <div className="w-[45%] overflow-hidden relative">
                  {mapUrl ? (
                    <img
                      src={mapUrl}
                      alt="Mapa trasy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <GradientPlaceholder index={0} />
                  )}
                  {isForking && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Right: 2 photos stacked */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex-1 overflow-hidden">
                    {template.cover_photos?.[0] ? (
                      <img
                        src={template.cover_photos[0]}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <GradientPlaceholder index={1} />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {template.cover_photos?.[1] ? (
                      <img
                        src={template.cover_photos[1]}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <GradientPlaceholder index={2} />
                    )}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5">
                {/* City + creator */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {city} <span className="text-muted-foreground/50">/</span> Polska
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {template.creator_handle}
                  </span>
                </div>

                {/* Type + points */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {personalityLabels[template.personality_type] || template.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {template.point_count} punktów
                  </span>
                </div>

                {/* Tags */}
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

      {/* "From scratch" link */}
      <div className="px-5 pb-safe-4 pb-6 pt-2 border-t border-border/20">
        <button
          onClick={() => navigate("/create", { state: { city, date: date.toISOString() } })}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Zaplanuj trasę od zera
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default TemplateSelection;
