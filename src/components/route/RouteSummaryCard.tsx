import { cn } from "@/lib/utils";

interface SummaryPin {
  place_name: string;
  realized_order?: number;
  was_spontaneous?: boolean;
  sequence_rating?: string;
  experience_note?: string;
  sentiment?: string;
  time_spent?: string;
}

interface RouteSummaryCardProps {
  summary: {
    summary_text?: string;
    highlight?: string;
    tip?: string;
    weather_impact?: string | null;
    intent?: {
      day_type?: string;
      group?: string;
      pace?: string;
    };
    pins?: SummaryPin[];
    considerations?: { place_name: string; rejection_reason?: string }[];
    deviations?: any[];
  };
}

const DAY_TYPE_ICONS: Record<string, string> = {
  romantic: "🌹",
  romantic_slow: "🌹",
  foodie: "🍽️",
  cultural: "🏛️",
  budget: "💰",
  family: "👨‍👩‍👧‍👦",
  adventure: "🏔️",
  fast_sightseeing: "⚡",
};

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  couple: "Para",
  family: "Rodzina",
  friends: "Znajomi",
};

const PACE_LABELS: Record<string, string> = {
  slow: "Spokojne tempo",
  moderate: "Umiarkowane",
  intense: "Intensywne",
};

const SEQUENCE_BADGES: Record<string, { label: string; className: string }> = {
  good_start: { label: "dobry start", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  perfect_after_previous: { label: "idealna kolejność", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  ideal_ending: { label: "idealne zakończenie", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  too_early: { label: "za wcześnie", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  too_late: { label: "za późno", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  wrong_order: { label: "zła kolejność", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const RouteSummaryCard = ({ summary }: RouteSummaryCardProps) => {
  const icon = DAY_TYPE_ICONS[summary.intent?.day_type || ""] || "📍";
  const group = GROUP_LABELS[summary.intent?.group || ""] || "";
  const pace = PACE_LABELS[summary.intent?.pace || ""] || "";
  const sortedPins = [...(summary.pins || [])].sort(
    (a, b) => (a.realized_order ?? 99) - (b.realized_order ?? 99)
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[18px] font-semibold text-foreground leading-tight">
          {icon} {summary.summary_text || "Twoja trasa"}
        </h3>
        {(group || pace) && (
          <p className="text-[13px] text-muted-foreground mt-1">
            {[group, pace].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Sequence */}
      <div className="px-5 pb-3">
        <div className="space-y-0">
          {sortedPins.map((pin, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              {/* Timeline */}
              <div className="flex flex-col items-center pt-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0",
                  pin.sentiment === "positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  pin.sentiment === "negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                {i < sortedPins.length - 1 && (
                  <div className="w-px h-6 bg-border/60 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-foreground truncate">
                    {pin.place_name}
                  </span>
                  {pin.was_spontaneous && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                      spontan
                    </span>
                  )}
                  {pin.sequence_rating && SEQUENCE_BADGES[pin.sequence_rating] && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      SEQUENCE_BADGES[pin.sequence_rating].className
                    )}>
                      {SEQUENCE_BADGES[pin.sequence_rating].label}
                    </span>
                  )}
                </div>
                {(pin.experience_note || pin.time_spent) && (
                  <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
                    {[pin.time_spent, pin.experience_note].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Highlight + Tip */}
      {(summary.highlight || summary.tip) && (
        <div className="px-5 pb-4 space-y-1.5">
          {summary.highlight && (
            <p className="text-[13px]">
              <span className="opacity-70">✨</span>{" "}
              <span className="text-foreground">{summary.highlight}</span>
            </p>
          )}
          {summary.tip && (
            <p className="text-[13px]">
              <span className="opacity-70">💡</span>{" "}
              <span className="text-muted-foreground">{summary.tip}</span>
            </p>
          )}
        </div>
      )}

      {/* Skipped considerations */}
      {summary.considerations && summary.considerations.length > 0 && (
        <div className="px-5 pb-4">
          {summary.considerations.map((c, i) => (
            <p key={i} className="text-[12px] text-muted-foreground/70">
              ❌ {c.place_name}{c.rejection_reason ? ` — ${c.rejection_reason}` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Footer meta */}
      <div className="px-5 py-3 border-t border-border/40 bg-muted/20">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <span>📍 {sortedPins.length} miejsc</span>
          {summary.deviations && summary.deviations.length > 0 && (
            <span>· {summary.deviations.length} zmian planu</span>
          )}
          {summary.weather_impact && <span>· 🌤️</span>}
        </div>
      </div>
    </div>
  );
};

export default RouteSummaryCard;
