import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, MapPin, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Preference labels ────────────────────────────────────────────────────────

const PREFERENCE_LABELS: Record<string, string> = {
  avoids_crowds: "Unika tłumów",
  likes_local_food: "Woli lokalne jedzenie",
  prefers_morning_start: "Ranny ptaszek",
  likes_spontaneous: "Lubi spontan",
  prefers_slow_pace: "Spokojne tempo",
  prefers_fast_pace: "Aktywne tempo",
  dislikes_museums: "Nie przepada za muzeami",
  likes_museums: "Lubi muzea",
  budget_conscious: "Oszczędna podróżniczka",
  likes_fine_dining: "Lubi fine dining",
  prefers_walking: "Woli spacery",
  likes_nightlife: "Lubi nocne życie",
  values_photography: "Nastawiona na zdjęcia",
  prefers_cultural: "Ceni kulturę i historię",
  dislikes_shopping: "Nie lubi zakupów",
  likes_shopping: "Lubi zakupy",
  prefers_nature: "Wolna natura niż miasto",
  always_reserves: "Rezerwuje z wyprzedzeniem",
  likes_hidden_gems: "Szuka ukrytych miejsc",
  avoids_tourist_traps: "Omija turystyczne pułapki",
};

function preferenceLabel(key: string): string {
  if (PREFERENCE_LABELS[key]) return PREFERENCE_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function preferenceValueLabel(value: string): string {
  const map: Record<string, string> = {
    strongly: "zdecydowanie",
    when_possible: "gdy możliwe",
    occasionally: "czasem",
    always: "zawsze",
    never: "nigdy",
    true: "tak",
    false: "nie",
    often: "często",
    rarely: "rzadko",
  };
  return map[value] ?? value;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return "bg-primary";
  if (confidence >= 0.4) return "bg-amber-400";
  return "bg-muted-foreground/40";
}

function evidenceLabel(count: number): string {
  if (count === 1) return "1 wyprawa";
  if (count <= 4) return `${count} wyprawy`;
  return `${count} wypraw`;
}

// ─── Main component ───────────────────────────────────────────────────────────

const TravelerProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: preferences, isLoading: prefLoading } = useQuery({
    queryKey: ["preference_graph", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preference_graph" as any)
        .select("preference_key, preference_value, confidence, evidence_count, last_updated")
        .eq("user_id", user!.id)
        .order("evidence_count", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{
        preference_key: string;
        preference_value: string;
        confidence: number;
        evidence_count: number;
        last_updated: string;
      }>;
    },
    enabled: !!user,
  });

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
      return (data ?? []) as Array<{
        city: string | null;
        content: string | null;
        metadata: any;
        created_at: string | null;
      }>;
    },
    enabled: !!user,
  });

  if (loading || !user) return null;

  const totalSignals = preferences?.reduce((s, p) => s + (p.evidence_count ?? 1), 0) ?? 0;
  const hasPreferences = (preferences?.length ?? 0) > 0;
  const hasMemories = (memories?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40">
        <button onClick={() => navigate("/settings")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Mój profil podróżniczy</h1>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">

        {/* Preferences section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Twoje preferencje podróżnicze</h2>
          </div>

          {prefLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !hasPreferences ? (
            <div className="bg-card rounded-xl p-5 text-center space-y-2 border border-border/40">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium">Twój profil dopiero rośnie</p>
              <p className="text-xs text-muted-foreground">
                Po każdej rozmowie po wycieczce zapamiętam co lubisz, a czego wolisz unikać.
                Wtedy zaproponuję Ci plan jeszcze lepiej skrojony pod Ciebie.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Zebrałam <span className="font-medium text-foreground">{totalSignals} sygnałów</span> z Twoich rozmów po podróżach
              </p>
              <div className="space-y-2">
                {preferences!.map((pref) => (
                  <div key={pref.preference_key} className="bg-card rounded-xl px-4 py-3 border border-border/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{preferenceLabel(pref.preference_key)}</span>
                      <span className="text-xs text-muted-foreground">
                        {preferenceValueLabel(pref.preference_value)} · {evidenceLabel(pref.evidence_count)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", confidenceColor(pref.confidence))}
                        style={{ width: `${Math.round(pref.confidence * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right">
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(pref.confidence * 100)}% pewności
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

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
      </div>
    </div>
  );
};

export default TravelerProfile;
