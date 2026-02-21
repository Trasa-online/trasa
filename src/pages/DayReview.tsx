import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Loader2, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatExperience from "@/components/route/ChatExperience";
import RoutePlanTimeline from "@/components/route/RoutePlanTimeline";

type Phase = "reminder" | "chat" | "saving" | "done";

interface RouteSummary {
  city?: string;
  intent?: Record<string, string>;
  pins?: any[];
  deviations?: any[];
  considerations?: any[];
  weather_impact?: string | null;
  highlight?: string;
  tip?: string;
  summary_text?: string;
}

const DayReview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
  const [phase, setPhase] = useState<Phase>("reminder");

  const { data: route, isLoading } = useQuery({
    queryKey: ["review-route", routeId],
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

  // Get folder info for total days
  const { data: folderRoutes } = useQuery({
    queryKey: ["folder-routes", route?.folder_id],
    queryFn: async () => {
      if (!route?.folder_id) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, day_number, title")
        .eq("folder_id", route.folder_id)
        .order("day_number");
      return data;
    },
    enabled: !!route?.folder_id,
  });

  const totalDays = folderRoutes?.length || 1;
  const dayNumber = route?.day_number || 1;

  const sortedPins = useMemo(() => {
    if (!route?.pins) return [];
    return [...(route.pins as any[])]
      .sort((a, b) => a.pin_order - b.pin_order)
      .map((p) => ({
        place_name: p.place_name,
        address: p.address,
        description: p.description,
        suggested_time: p.suggested_time,
      }));
  }, [route]);

  const timelineDays = useMemo(() => [{
    day_number: dayNumber,
    pins: sortedPins,
  }], [dayNumber, sortedPins]);

  const handleChatComplete = (_summary: RouteSummary) => {
    setPhase("saving");
    // The chat-route edge function already saves everything
    setTimeout(() => setPhase("done"), 1500);
  };

  const handleViewRoute = () => {
    if (routeId) {
      navigate(`/route/${routeId}`);
    } else {
      navigate("/");
    }
  };

  if (isLoading || !route) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-muted px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/home")} className="p-1 text-foreground/70">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
          <button onClick={() => navigate("/settings")} className="p-1 text-foreground/70">
            <Settings className="h-6 w-6" />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-muted px-4 py-4 flex items-center justify-between">
        <button 
          onClick={() => {
            if (phase === "chat") setPhase("reminder");
            else navigate("/home");
          }} 
          className="p-1 text-foreground/70"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
        <button onClick={() => navigate("/settings")} className="p-1 text-foreground/70">
          <Settings className="h-6 w-6" />
        </button>
      </header>

      {/* Phase: Reminder */}
      {phase === "reminder" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* AI intro message */}
            <div className="px-5 pt-6 pb-2">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] text-[14px] leading-relaxed">
                Czy Twój dzień przebiegł zgodnie z planem?
              </div>
            </div>

            {/* Day timeline */}
            <div className="px-1">
              <RoutePlanTimeline days={timelineDays} totalDays={totalDays} />
            </div>
          </div>

          {/* Input area placeholder - starts the chat */}
          <div className="border-t border-border/40 bg-background p-3">
            <div className="flex items-end gap-2 max-w-lg mx-auto">
              <div className="flex-1">
                <button
                  onClick={() => setPhase("chat")}
                  className="w-full text-left rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[14px] text-muted-foreground/50"
                >
                  Napisz odpowiedź...
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase: Chat */}
      {phase === "chat" && (
        <ChatExperience
          routeId={routeId!}
          pins={sortedPins}
          onComplete={handleChatComplete}
          onSkip={() => navigate("/")}
        />
      )}

      {/* Phase: Saving */}
      {phase === "saving" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Zapisuję podsumowanie...</p>
        </div>
      )}

      {/* Phase: Done */}
      {phase === "done" && (
        <div className="flex-1 flex flex-col">
          {/* Close button */}
          <div className="flex justify-end p-4">
            <button onClick={() => navigate("/")} className="text-foreground/60 hover:text-foreground">
              <X className="h-7 w-7" />
            </button>
          </div>

          {/* Thank you message */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
            <h2 className="text-2xl font-black text-center">Super!</h2>
            <h2 className="text-2xl font-black text-center">Dziękuję za rozmowę.</h2>
            <p className="text-muted-foreground text-center mt-4 text-base leading-relaxed">
              Zapisałam Twoje odpowiedzi{"\n"}i zaktualizowałam trasę względem{"\n"}wcześniejszego planu.
            </p>
          </div>

          {/* View button */}
          <div className="p-4 pb-8">
            <Button
              onClick={handleViewRoute}
              variant="outline"
              size="lg"
              className="w-full rounded-full text-base font-medium"
            >
              Zobacz
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayReview;
