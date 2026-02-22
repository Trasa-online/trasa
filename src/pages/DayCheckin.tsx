import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DayCheckin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: route, isLoading } = useQuery({
    queryKey: ["checkin-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("*, pins(*)")
        .eq("id", routeId)
        .single();
      return data;
    },
    enabled: !!routeId && !!user,
  });

  const sortedPins = route?.pins
    ? [...(route.pins as any[])].sort((a, b) => a.pin_order - b.pin_order)
    : [];

  // Default: all visited (true). False means skipped.
  const isVisited = (pinId: string) => visited[pinId] !== false;

  const togglePin = (pinId: string) => {
    setVisited(prev => ({ ...prev, [pinId]: !isVisited(pinId) }));
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await Promise.all(
        sortedPins.map((pin: any) =>
          supabase.from("pins").update({ was_skipped: !isVisited(pin.id) }).eq("id", pin.id)
        )
      );
    } catch (err) {
      console.error("Failed to save pin visits:", err);
    }
    setSaving(false);
    navigate(`/day-review?route=${routeId}`);
  };

  const header = (
    <header className="bg-muted px-4 py-4 flex items-center justify-between">
      <button onClick={() => navigate("/")} className="p-1 text-foreground/70">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <button onClick={() => navigate("/")} className="text-2xl font-black tracking-tight">
        TRASA
      </button>
      <button onClick={() => navigate("/settings")} className="p-1 text-foreground/70">
        <Settings className="h-6 w-6" />
      </button>
    </header>
  );

  if (isLoading || !route) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {header}

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
        <h2 className="text-lg font-bold mb-1">Które miejsca odwiedziłeś?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Odznacz miejsca, które pominąłeś — zapytamy Cię o nie w rozmowie.
        </p>

        <div className="space-y-3">
          {sortedPins.map((pin: any, idx: number) => {
            const checked = isVisited(pin.id);
            return (
              <button
                key={pin.id}
                onClick={() => togglePin(pin.id)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
                  checked
                    ? "border-foreground/20 bg-background"
                    : "border-dashed border-border/40 bg-muted/20 opacity-50"
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    checked
                      ? "border-foreground bg-foreground"
                      : "border-border/50 bg-transparent"
                  )}
                >
                  {checked && <Check className="h-3.5 w-3.5 text-background" />}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[14px] font-medium",
                      !checked && "line-through text-muted-foreground"
                    )}
                  >
                    {idx + 1}. {pin.place_name}
                  </p>
                  {pin.suggested_time && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {pin.suggested_time}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 px-5 py-4">
        <Button
          onClick={handleContinue}
          disabled={saving}
          size="lg"
          className="w-full rounded-full text-base font-medium"
        >
          {saving ? "Zapisuję..." : "Dalej — oceń dzień"}
        </Button>
      </div>
    </div>
  );
};

export default DayCheckin;
