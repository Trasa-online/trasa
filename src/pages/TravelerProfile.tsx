import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MapPin, BookOpen, Settings, ChevronRight, Copy, Check, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ── InviteSlot ────────────────────────────────────────────────────────────────

function InviteSlot({ code, slot, usedByName, usedByEmail }: {
  code: string;
  slot: number;
  usedByName: string | null;
  usedByEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/join/${code}`;
  const isUsed = !!(usedByName || usedByEmail);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Zaproszenie {slot}
        </p>
        {isUsed ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            Czeka na akceptację
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Niewykorzystane
          </span>
        )}
      </div>

      {isUsed ? (
        <p className="text-sm text-foreground/80">
          Zaproszono: <span className="font-semibold">{usedByName || usedByEmail}</span>
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground font-mono truncate">
            {url}
          </div>
          <button
            onClick={handleCopy}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background active:bg-muted transition-colors flex-shrink-0"
          >
            {copied
              ? <Check className="h-4 w-4 text-green-600" />
              : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── TravelerProfile ───────────────────────────────────────────────────────────

const TravelerProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, first_name")
        .eq("id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: referralCodes = [] } = useQuery({
    queryKey: ["referral-codes", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("referral_codes")
        .select("code, slot, used_by_name, used_by_email")
        .eq("owner_id", user!.id)
        .order("slot");
      return (data ?? []) as Array<{
        code: string;
        slot: number;
        used_by_name: string | null;
        used_by_email: string | null;
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

  const displayName = profile?.first_name || profile?.username || "";
  const hasMemories = (memories?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader title="Mój profil" showBack />

      <div className="p-4 space-y-6 max-w-lg mx-auto">

        {/* User identity */}
        <div className="flex items-center gap-4 py-2">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 text-xl font-bold">
              {displayName.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            {profile?.first_name && (
              <p className="text-xl font-black leading-tight">{profile.first_name}</p>
            )}
            {profile?.username && (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}
          </div>
        </div>

        {/* Invite section */}
        {referralCodes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Zaproś znajomych</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Masz 2 zaproszenia. Każda zaproszona osoba musi zostać zatwierdzona przez admina.
            </p>
            {referralCodes.map(rc => (
              <InviteSlot
                key={rc.code}
                code={rc.code}
                slot={rc.slot}
                usedByName={rc.used_by_name}
                usedByEmail={rc.used_by_email}
              />
            ))}
          </section>
        )}

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
                      {date && <span className="text-xs text-muted-foreground">{date}</span>}
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
