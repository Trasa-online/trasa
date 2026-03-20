import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface JournalTabProps {
  userId: string;
}

const JournalTab = ({ userId }: JournalTabProps) => {
  const navigate = useNavigate();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos")
        .eq("user_id", userId)
        .eq("chat_status", "completed")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Ładowanie...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-sm font-medium text-foreground/70 mb-1">Dziennik jest pusty</p>
        <p className="text-xs text-muted-foreground">
          Po zakończeniu rozmowy podsumowującej dzień, wpis pojawi się tutaj.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {entries.map((entry) => {
        const thumb = entry.review_photos?.[0] ?? getRandomPinPlaceholder(entry.id);
        const dateLabel = entry.start_date
          ? format(new Date(entry.start_date), "d MMMM yyyy", { locale: pl })
          : "";

        return (
          <button
            key={entry.id}
            onClick={() => navigate(`/review-summary?route=${entry.id}`)}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border/50 overflow-hidden text-left hover:bg-card/80 active:bg-muted transition-colors"
          >
            {/* Thumbnail */}
            <div className="w-20 h-20 shrink-0 overflow-hidden">
              <img
                src={thumb}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 py-3 pr-3">
              <p className="text-sm font-semibold leading-tight truncate">
                {entry.city || "Podróż"}
                {entry.day_number ? ` · Dzień ${entry.day_number}` : ""}
              </p>
              {dateLabel && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{dateLabel}</p>
              )}
              {entry.ai_summary && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                  {entry.ai_summary}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default JournalTab;
