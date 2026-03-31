import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Copy, Check } from "lucide-react";
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
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
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
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex-1 bg-card border border-border/40 rounded-2xl py-4 flex flex-col items-center gap-1">
      <span className="text-2xl font-black text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

// ── CompletionRing ────────────────────────────────────────────────────────────

function CompletionRing({ percent, children }: { percent: number; children: React.ReactNode }) {
  const size = 108;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#EA580C" strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
      {/* Percent badge */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
        {percent}%
      </div>
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

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      const { data: routes } = await supabase
        .from("routes")
        .select("city, start_date, chat_status")
        .eq("user_id", user!.id);

      const all = routes ?? [];
      const completed = all.filter(r => r.chat_status === "completed").length;
      const cities = new Set(all.map(r => r.city).filter(Boolean)).size;
      const days = all.filter(r => r.start_date).length;
      return { trips: all.length, completed, cities, days };
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
      return (data ?? []) as Array<{ code: string; slot: number; used_by_name: string | null; used_by_email: string | null }>;
    },
    enabled: !!user,
  });

  if (loading || !user) return null;

  const displayName = profile?.first_name || profile?.username || "";

  // Profile completion: avatar, first_name, username = 3 fields
  const completionFields = [!!profile?.avatar_url, !!profile?.first_name, !!profile?.username];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe-4 pb-3">
        <div className="w-9" />
        <h1 className="text-base font-black tracking-tight">Mój profil</h1>
        <button
          onClick={() => navigate("/settings")}
          className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 space-y-6 max-w-lg mx-auto">

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-5 pt-1">
          <CompletionRing percent={completionPct}>
            <Avatar className="h-[88px] w-[88px]">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-3xl font-black">
                {displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </CompletionRing>

          <div className="text-center mt-2">
            <h2 className="text-2xl font-black leading-tight">
              {profile?.first_name || profile?.username || "Użytkownik"}
            </h2>
            {profile?.username && profile?.first_name && (
              <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <StatCard value={stats?.trips ?? 0} label="Tras" />
          <StatCard value={stats?.cities ?? 0} label="Miast" />
          <StatCard value={stats?.days ?? 0} label="Dni" />
        </div>

        {/* Invites */}
        {referralCodes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Zaproś znajomych</p>
              <p className="text-xs text-muted-foreground">{referralCodes.length} zaproszenia</p>
            </div>
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

      </div>
    </div>
  );
};

export default TravelerProfile;
