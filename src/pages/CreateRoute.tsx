import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import PlanChatExperience from "@/components/route/PlanChatExperience";
import RouteSummaryDialog from "@/components/route/RouteSummaryDialog";

interface TripPreferences {
  numDays: 1;
  pace: "active" | "calm" | "mixed";
  priorities: string[];
  startDate: string | null;
  planningMode: "voice" | "text";
  city: string;
  folderId?: string;
  dayNumber?: number;
}

const CreateRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wizardState = (location.state as { city?: string; date?: string; fromTemplate?: boolean; routeId?: string; initialPlan?: any; likedPlaceNames?: string[]; skippedPlaceNames?: string[] } | null);
  const fromTemplate = wizardState?.fromTemplate ?? false;
  const templateInitialPlan = wizardState?.initialPlan ?? null;
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("trip") ?? undefined;
  const dayNumber = searchParams.get("day") ? parseInt(searchParams.get("day")!) : undefined;
  const creatorPlanId = searchParams.get("creatorPlan") ?? undefined;
  const initialUserMessage = searchParams.get("q") ?? undefined;
  const wizardLikedPlaces = wizardState?.likedPlaceNames ?? [];
  const wizardSkippedPlaces = wizardState?.skippedPlaceNames ?? [];
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
    numDays: 1,
    pace: "mixed",
    priorities: [],
    startDate: wizardDate ? wizardDate.toISOString().slice(0, 10) : null,
    planningMode: "text",
    city: wizardState?.city ?? "",
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
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40 flex-shrink-0">
        <button onClick={() => fromTemplate ? navigate("/plan") : navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t("planning_title")}</h1>
      </div>

      <div className="flex-1 min-h-0">
        <PlanChatExperience
          preferences={preferences}
          onPlanReady={handlePlanReady}
          likedPlaces={likedPlaces}
          skippedPlaces={wizardSkippedPlaces}
          idealDay={idealDay}
          initialUserMessage={initialUserMessage}
          initialPlan={templateInitialPlan ?? undefined}
        />
      </div>

      {finalPlan && (
        <RouteSummaryDialog
          open={showSummary}
          onOpenChange={setShowSummary}
          plan={finalPlan}
          preferences={preferences}
          messages={finalMessages}
        />
      )}
    </div>
  );
};

export default CreateRoute;
