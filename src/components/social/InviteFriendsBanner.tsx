import { UserPlus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useShare } from "@/hooks/useShare";
import { useMyInviteCode, inviteLinkFromCode } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";

// Baner "Zapros znajomych do trasy!" - share linku /dodaj/:code (auto-przyjazn = viral loop).
// Delikatny (leciutki niebieski + subtelny pulsujacy poblask tla), nie krzykliwy.
export default function InviteFriendsBanner({ className }: { className?: string }) {
  const { user, isAnonymous } = useAuth();
  const share = useShare();
  const { data: code } = useMyInviteCode(isAnonymous ? null : user?.id);

  if (!user || isAnonymous || !code) return null;
  const link = inviteLinkFromCode(code);

  const onInvite = async () => {
    const res = await share({
      title: "Dołącz do mnie na Trasie",
      text: "Planujmy razem trasy po mieście! Dołącz do mnie na Trasie:",
      url: link,
    });
    if (res.method === "clipboard") toast("Link skopiowany - wyślij go znajomym!");
  };

  return (
    <button
      onClick={onInvite}
      className={cn(
        "relative w-full overflow-hidden flex items-center gap-3 rounded-3xl p-4 text-left active:scale-[0.99] transition-transform border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/70",
        className,
      )}
    >
      {/* Delikatny pulsujacy poblask tla */}
      <span
        className="pointer-events-none absolute inset-0 animate-pulse"
        style={{ background: "radial-gradient(150px 90px at 16% 50%, rgba(96,165,250,0.22), transparent 70%)" }}
      />
      <div className="relative h-11 w-11 rounded-2xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
        <UserPlus className="h-5 w-5 text-blue-600" />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="font-display font-extrabold text-base leading-tight text-foreground">Zaproś znajomych do trasy!</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Wyślij link - po dołączeniu od&nbsp;razu jesteście znajomymi.</p>
      </div>
      <ChevronRight className="relative h-5 w-5 text-blue-400 shrink-0" />
    </button>
  );
}
