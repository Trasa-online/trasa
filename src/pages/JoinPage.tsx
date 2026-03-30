import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InviteData {
  inviterName: string;
  inviterUsername: string;
  inviterAvatar: string | null;
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!code) { setInvalid(true); setLoading(false); return; }

    (async () => {
      const { data: referral } = await (supabase as any)
        .from("referral_codes")
        .select("owner_id, used_at")
        .eq("code", code)
        .single();

      if (!referral) { setInvalid(true); setLoading(false); return; }

      if (referral.used_at) { setInvalid(true); setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url, first_name")
        .eq("id", referral.owner_id)
        .single();

      if (!profile) { setInvalid(true); setLoading(false); return; }

      setInvite({
        inviterName: (profile as any).first_name || profile.username || "użytkownik",
        inviterUsername: profile.username || "",
        inviterAvatar: profile.avatar_url || null,
      });
      setLoading(false);
    })();
  }, [code]);

  const handleJoin = () => {
    if (code) localStorage.setItem("pending_referral_code", code);
    navigate("/auth?tab=register");
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Ładowanie…</div>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">🔗</p>
        <p className="text-lg font-bold">Link nieaktywny</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ten link zaproszenia wygasł lub został już wykorzystany.
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
        >
          Przejdź do logowania
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">

        {/* App name */}
        <h1 className="text-4xl font-black tracking-tight">TRASA</h1>

        {/* Inviter card */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-6 flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20">
            <AvatarImage src={invite!.inviterAvatar || ""} />
            <AvatarFallback className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 text-2xl font-bold">
              {invite!.inviterName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div>
            <p className="font-black text-xl">{invite!.inviterName}</p>
            {invite!.inviterUsername && (
              <p className="text-sm text-muted-foreground mt-0.5">@{invite!.inviterUsername}</p>
            )}
          </div>

          <p className="text-base text-foreground/80 leading-relaxed">
            zaprasza Cię do <span className="font-bold">Trasa</span>
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
          Planuj miejskie przygody, odkrywaj polecane miejsca i twórz wspomnienia z podróży.
        </p>

        {/* CTA */}
        <button
          onClick={handleJoin}
          className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/25"
        >
          Dołącz do Trasa
        </button>

        <p className="text-xs text-muted-foreground">
          Twoje konto wymaga zatwierdzenia przez admina — zwykle trwa to do 24h.
        </p>
      </div>
    </div>
  );
}
