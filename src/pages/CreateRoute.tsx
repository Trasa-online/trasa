import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import PlanChatExperience from "@/components/route/PlanChatExperience";
import RouteSummaryDialog from "@/components/route/RouteSummaryDialog";

interface TripPreferences {
  numDays: number;
  pace: "active" | "calm" | "mixed";
  priorities: string[];
  startDate: string | null;
  planningMode: "voice" | "text";
  city: string;
  startingLocation?: string;
  folderId?: string;
  dayNumber?: number;
}

interface MatchedRouteStub {
  id: string;
  title: string;
  personality_type: string;
  pins: { place_name: string; category: string; suggested_time: string; duration_minutes: number; walking_time_from_prev: string | null; note?: string | null }[];
}

const CreateRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wizardState = (location.state as {
    city?: string; date?: string; numDays?: number; startingLocation?: string; fromTemplate?: boolean; routeId?: string;
    initialPlan?: any; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; superLikedPlaceNames?: string[];
    likedPlacesData?: { place_name: string; category: string; description: string; latitude?: number; longitude?: number }[];
    matchedRoutes?: MatchedRouteStub[]; selectedRouteIndex?: number;
    backTo?: string;
    groupSession?: { sessionId: string; otherMemberIds: string[] };
  } | null);
  const matchedRoutes = wizardState?.matchedRoutes ?? [];
  const [altIndex, setAltIndex] = useState(wizardState?.selectedRouteIndex ?? 0);

  const buildPlan = (route: MatchedRouteStub, city: string) => ({
    city,
    days: [{ day_number: 1, pins: route.pins.map(p => ({ place_name: p.place_name, address: "", description: p.note ?? "", suggested_time: p.suggested_time, duration_minutes: p.duration_minutes, category: p.category, latitude: 0, longitude: 0, day_number: 1, walking_time_from_prev: p.walking_time_from_prev ?? null })) }],
  });

  const currentCity = wizardState?.city ?? "";
  const templateInitialPlan = matchedRoutes.length > 0
    ? buildPlan(matchedRoutes[altIndex] ?? matchedRoutes[0], currentCity)
    : (wizardState?.initialPlan ?? null);
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("trip") ?? undefined;
  const dayNumber = searchParams.get("day") ? parseInt(searchParams.get("day")!) : undefined;
  const creatorPlanId = searchParams.get("creatorPlan") ?? undefined;
  const initialUserMessage = searchParams.get("q") ?? undefined;
  const wizardLikedPlaces = wizardState?.likedPlaceNames ?? [];
  const wizardSkippedPlaces = wizardState?.skippedPlaceNames ?? [];
  const wizardLikedPlacesData = wizardState?.likedPlacesData ?? [];
  const wizardSuperLikedPlaces = wizardState?.superLikedPlaceNames ?? [];
  const [likedPlaces, setLikedPlaces] = useState<string[]>(wizardLikedPlaces);
  const [idealDay] = useState("");

  useEffect(() => {
    if (!creatorPlanId) return;
    supabase
      .from("creator_places")
      .select("place_name")
      .eq("plan_id", creatorPlanId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data?.length) setLikedPlaces(data.map(p => p.place_name));
      });
  }, [creatorPlanId]);

  const wizardDate = wizardState?.date ? new Date(wizardState.date) : undefined;
  const [preferences] = useState<TripPreferences>({
    numDays: wizardState?.numDays ?? 1,
    pace: "mixed",
    priorities: [],
    startDate: wizardDate ? wizardDate.toISOString().slice(0, 10) : null,
    planningMode: "text",
    city: wizardState?.city ?? "",
    startingLocation: wizardState?.startingLocation,
    folderId,
    dayNumber,
  });
  const [showSummary, setShowSummary] = useState(false);
  const [finalPlan, setFinalPlan] = useState<any>(null);
  const [finalMessages, setFinalMessages] = useState<any[]>([]);

  const { t } = useTranslation("create-route");

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const handlePlanReady = (plan: any, messages: any[]) => {
    setFinalPlan(plan);
    setFinalMessages(messages);
    setShowSummary(true);
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/40">
        <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3">
          <button
            onClick={() => {
              if (wizardState?.backTo) {
                navigate(wizardState.backTo);
              } else if (currentCity && wizardState?.date) {
                navigate("/plan", {
                  state: {
                    step: 3,
                    city: currentCity,
                    date: wizardState?.date,
                    likedPlaceNames: wizardLikedPlaces,
                    skippedPlaceNames: wizardSkippedPlaces,
                  },
                });
              } else {
                navigate("/");
              }
            }}
            className="p-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">
              {currentCity || t("planning_title")}
            </h1>
            {preferences.numDays > 1 && dayNumber && (
              <p className="text-xs text-muted-foreground">
                Dzień {dayNumber} z {preferences.numDays}
              </p>
            )}
          </div>
        </div>

        {/* Day tabs — shown when editing an existing multi-day trip */}
        {folderId && preferences.numDays > 1 && dayNumber && (
          <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
            {Array.from({ length: preferences.numDays }, (_, i) => i + 1).map(d => (
              <button
                key={d}
                onClick={() => navigate(`/create?trip=${folderId}&day=${d}`, { state: wizardState })}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  d === dayNumber
                    ? "bg-foreground text-background border-transparent"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Dzień {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <PlanChatExperience
          key={altIndex}
          preferences={preferences}
          onPlanReady={handlePlanReady}
          likedPlaces={likedPlaces}
          likedPlacesData={wizardLikedPlacesData}
          skippedPlaces={wizardSkippedPlaces}
          superLikedPlaces={wizardSuperLikedPlaces}
          idealDay={idealDay}
          initialUserMessage={initialUserMessage}
          initialPlan={templateInitialPlan ?? undefined}
          altRoutes={matchedRoutes.map(r => ({ id: r.id, title: r.title, personality_type: r.personality_type }))}
          altIndex={altIndex}
          onSwitchAlt={setAltIndex}
        />
      </div>

      {finalPlan && (
        <RouteSummaryDialog
          open={showSummary}
          onOpenChange={setShowSummary}
          plan={finalPlan}
          preferences={preferences}
          messages={finalMessages}
          groupSession={wizardState?.groupSession}
        />
      )}
    </div>
  );
};

export default CreateRoute;
