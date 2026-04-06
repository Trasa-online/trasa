import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Globe, Lock } from "lucide-react";

interface JournalTabProps {
  userId: string;
}

const JournalTab = ({ userId }: JournalTabProps) => {
  const navigate = useNavigate();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      // Own completed routes
      const { data: ownRoutes } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, is_shared")
        .eq("user_id", userId)
        .eq("chat_status", "completed")
        .order("updated_at", { ascending: false });

      // Group routes created by others that user is a member of
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("session_id")
        .eq("user_id", userId);

      let groupRoutes: any[] = [];
      if (memberRows?.length) {
        const sessionIds = memberRows.map((m: any) => m.session_id);
        const { data } = await (supabase as any)
          .from("routes")
          .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos")
          .in("group_session_id", sessionIds)
          .neq("user_id", userId)
          .eq("chat_status", "completed")
          .order("updated_at", { ascending: false });
        groupRoutes = data || [];
      }

      return [...(ownRoutes ?? []), ...groupRoutes] as any[];
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
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-24 text-center">
        <div className="w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <div className="space-y-2">
          <p className="text-xl font-bold tracking-tight">Wkrótce tutaj</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
            Po zakończeniu rozmowy podsumowującej dzień, wpis pojawi się tutaj.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-2">
      {entries.map((entry) => {
        const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
        const thumb = validPhotos[0] ?? getRandomPinPlaceholder(entry.id);
        const dateLabel = entry.start_date
          ? format(new Date(entry.start_date), "d MMMM yyyy", { locale: pl })
          : "";
        const hasUserPhoto = validPhotos.length > 0;

        return (
          <button
            key={entry.id}
            onClick={() => navigate(`/review-summary?route=${entry.id}`)}
            className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform"
          >
            {/* Cover photo */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
              <img
                src={thumb}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fallback"); }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {/* City + date badge on photo */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">
                  {entry.city || "Podróż"}
                  {entry.day_number ? <span className="font-normal text-white/80"> · Dzień {entry.day_number}</span> : ""}
                </p>
                {dateLabel && (
                  <p className="text-white/70 text-xs mt-0.5">{dateLabel}</p>
                )}
              </div>
              {/* Privacy badge */}
              <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                {entry.is_shared === false
                  ? <Lock className="h-3 w-3 text-white/80" />
                  : <Globe className="h-3 w-3 text-white/80" />
                }
              </div>
              {/* "Twoje zdjęcie" badge if user uploaded a photo */}
              {hasUserPhoto && (
                <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white/90">
                  📷 Twoje zdjęcie
                </div>
              )}
            </div>

            {/* Text below photo */}
            {(entry.ai_highlight || entry.ai_summary) && (
              <div className="px-4 py-3">
                {entry.ai_highlight && (
                  <p className="text-sm text-foreground/80 italic leading-snug mb-1.5">
                    "{entry.ai_highlight}"
                  </p>
                )}
                {entry.ai_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {entry.ai_summary}
                  </p>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default JournalTab;
