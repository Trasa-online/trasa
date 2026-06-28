import { UserPlus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useShare } from "@/hooks/useShare";
import { useMyInviteCode, inviteLinkFromCode } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";

// Baner "Zapros znajomych do trasy!" - share linku /dodaj/:code (auto-przyjazn = viral loop).
// Na home (ActiveTripsDashboard) i na profilu. Tylko dla zalogowanych non-anon.
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
        "w-full flex items-center gap-3 rounded-3xl p-4 text-left text-white active:scale-[0.99] transition-transform shadow-md shadow-orange-500/25 bg-gradient-to-r from-[#F4A259] to-[#F9662B]",
        className,
      )}
    >
      <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
        <UserPlus className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-extrabold text-base leading-tight">Zaproś znajomych do trasy!</p>
        <p className="text-xs text-white/85 mt-0.5 leading-snug">Wyślij link - po dołączeniu od&nbsp;razu jesteście znajomymi.</p>
      </div>
      <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
    </button>
  );
}
