import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinReviewBadgesProps {
  pin: {
    expectation_met?: string | null;
    trip_role?: string | null;
    pros?: string[] | null;
    cons?: string[] | null;
    one_liner?: string | null;
    recommended_for?: string[] | null;
  };
  compact?: boolean;
}

const EXPECTATION_CONFIG: Record<string, { emoji: string; label: string; className: string }> = {
  yes: {
    emoji: "😊",
    label: "Spełniło oczekiwania",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  average: {
    emoji: "😐",
    label: "Średnio",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  no: {
    emoji: "😕",
    label: "Poniżej oczekiwań",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
};

const TRIP_ROLE_CONFIG: Record<string, { emoji: string; label: string; className: string }> = {
  must_see: {
    emoji: "⭐",
    label: "Punkt obowiązkowy",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  nice_addition: {
    emoji: "➕",
    label: "Fajny dodatek",
    className: "bg-secondary text-secondary-foreground border-border",
  },
  skippable: {
    emoji: "🔁",
    label: "Można pominąć",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const PinReviewBadges = ({ pin, compact = false }: PinReviewBadgesProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasExpectation = pin.expectation_met && EXPECTATION_CONFIG[pin.expectation_met];
  const hasTripRole = pin.trip_role && TRIP_ROLE_CONFIG[pin.trip_role];
  const hasOneLiner = pin.one_liner && pin.one_liner.trim().length > 0;
  const hasPros = pin.pros && pin.pros.length > 0;
  const hasCons = pin.cons && pin.cons.length > 0;
  const hasRecommendedFor = pin.recommended_for && pin.recommended_for.length > 0;

  const hasAnyData = hasExpectation || hasTripRole || hasOneLiner || hasPros || hasCons || hasRecommendedFor;
  const hasExpandableData = hasPros || hasCons || hasRecommendedFor;

  if (!hasAnyData) return null;

  const expectationConfig = hasExpectation ? EXPECTATION_CONFIG[pin.expectation_met!] : null;
  const tripRoleConfig = hasTripRole ? TRIP_ROLE_CONFIG[pin.trip_role!] : null;

  return (
    <div className="mt-2 space-y-1.5">
      {/* Always visible: badges + one-liner */}
      <div className="flex flex-wrap gap-1.5">
        {expectationConfig && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border", expectationConfig.className)}>
            <span>{expectationConfig.emoji}</span>
            {expectationConfig.label}
          </span>
        )}
        {tripRoleConfig && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border", tripRoleConfig.className)}>
            <span>{tripRoleConfig.emoji}</span>
            {tripRoleConfig.label}
          </span>
        )}
      </div>

      {hasOneLiner && (
        <p className="text-xs italic text-muted-foreground leading-relaxed">
          „{pin.one_liner}"
        </p>
      )}

      {/* Expandable section */}
      {hasExpandableData && (
        <>
          {expanded && (
            <div className="space-y-2 pt-1">
              {hasPros && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-0.5">👍</span>
                  <div className="flex flex-wrap gap-1">
                    {pin.pros!.map((pro) => (
                      <span
                        key={pro}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                      >
                        {pro}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {hasCons && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-0.5">👎</span>
                  <div className="flex flex-wrap gap-1">
                    {pin.cons!.map((con) => (
                      <span
                        key={con}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                      >
                        {con}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {hasRecommendedFor && (
                <div className="flex items-start gap-1.5">
                  <Users className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {pin.recommended_for!.map((rec) => (
                      <span
                        key={rec}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      >
                        {rec}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")} />
            {expanded ? "Zwiń" : "Pokaż więcej"}
          </button>
        </>
      )}
    </div>
  );
};

export default PinReviewBadges;
