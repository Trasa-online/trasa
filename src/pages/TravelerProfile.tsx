import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MapPin, BookOpen, Settings, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const TravelerProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: memories, isLoading: memLoading } = useQuery({
    queryKey: ["user_memory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_memory" as any)
        .select("city, content, metadata, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        city: string | null;
        content: string | null;
        metadata: any;
        created_at: string | null;
      }>;
    },
    enabled: !!user,
  });

  const { data: journalRoutes } = useQuery({
    queryKey: ["journal-routes-profile", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("id, title, city, start_date, ai_summary")
        .eq("user_id", user.id)
        .eq("chat_status", "completed")
        .not("ai_summary", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  if (loading || !user) return null;

  const hasMemories = (memories?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader title="Mój profil" showBack />

      <div className="p-4 space-y-6 max-w-lg mx-auto">

        {/* Memories section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Wspomnienia z podróży</h2>
          </div>

          {memLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !hasMemories ? (
            <div className="bg-card rounded-xl p-5 text-center border border-border/40">
              <p className="text-xs text-muted-foreground">
                Tu pojawią się Twoje podróże po zakończeniu rozmowy podsumowującej dzień.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories!.map((mem, i) => {
                const meta = (mem.metadata as any) ?? {};
                const highlight = meta.ai_highlight as string | undefined;
                const tip = meta.ai_tip as string | undefined;
                const date = mem.created_at
                  ? format(new Date(mem.created_at), "d MMM yyyy", { locale: pl })
                  : null;

                return (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border/40 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{mem.city ?? "Podróż"}</span>
                      {date && (
                        <span className="text-xs text-muted-foreground">{date}</span>
                      )}
                    </div>
                    {highlight && (
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        <span className="font-medium">✨ Highlight:</span> {highlight}
                      </p>
                    )}
                    {tip && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium">💡 Tip:</span> {tip}
                      </p>
                    )}
                    {!highlight && !tip && mem.content && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {mem.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Journal section */}
        {journalRoutes && journalRoutes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Dziennik podróży</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {journalRoutes.map((route: any, idx: number) => {
                const DOTS = ["bg-blue-400", "bg-violet-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400", "bg-cyan-400"];
                return (
                  <div key={route.id} className="rounded-2xl bg-card border border-border/40 p-3.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-tight truncate">{route.city || route.title}</p>
                        {route.start_date && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {format(new Date(route.start_date), "dd/MM/yy")}
                          </p>
                        )}
                      </div>
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1 ml-2 ${DOTS[idx % DOTS.length]}`} />
                    </div>
                    {route.ai_summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 mt-1">
                        {route.ai_summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Settings link */}
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border/40 hover:bg-muted transition-colors text-left"
        >
          <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium flex-1">Ustawienia konta</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

      </div>
    </div>
  );
};

export default TravelerProfile;
