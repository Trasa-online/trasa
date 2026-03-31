import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, ChevronRight, Copy, Check, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
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

  if (loading || !user) return null;

  const displayName = profile?.first_name || profile?.username || "";

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

        {/* Settings link */}
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
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
