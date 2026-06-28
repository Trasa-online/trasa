import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UserPlus, Check, Clock, UserCheck, Loader2 } from "lucide-react";
import { useFriendStatus, sendFriendRequest, acceptFriendRequest, removeFriend } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";

// Przycisk relacji z userem: Dodaj / Wyslano / Akceptuj / Znajomi. Mutacje przez RPC.
export default function FriendButton({ targetUserId, className }: { targetUserId: string; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: status = "none" } = useFriendStatus(user?.id, targetUserId);
  const [busy, setBusy] = useState(false);

  if (!user || status === "self") return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["friend-status", user.id, targetUserId] });
    qc.invalidateQueries({ queryKey: ["friends", user.id] });
    qc.invalidateQueries({ queryKey: ["friend-requests-in", user.id] });
  };
  const act = async (fn: () => Promise<{ error: any }>, okMsg?: string) => {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      if (okMsg) toast(okMsg);
      refresh();
    } catch {
      toast.error("Coś poszło nie tak");
    } finally {
      setBusy(false);
    }
  };

  const base = "shrink-0 h-9 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60";

  if (busy) return <button disabled className={cn(base, "bg-muted text-muted-foreground", className)}><Loader2 className="h-3.5 w-3.5 animate-spin" /></button>;

  if (status === "friends")
    return (
      <button onClick={() => act(() => removeFriend(targetUserId), "Usunięto ze znajomych")} className={cn(base, "bg-muted text-foreground", className)}>
        <UserCheck className="h-3.5 w-3.5 text-green-600" /> Znajomi
      </button>
    );
  if (status === "pending_in")
    return (
      <button onClick={() => act(() => acceptFriendRequest(targetUserId), "Dodano znajomego!")} className={cn(base, "bg-primary text-white", className)}>
        <Check className="h-3.5 w-3.5" /> Akceptuj
      </button>
    );
  if (status === "pending_out")
    return (
      <button onClick={() => act(() => removeFriend(targetUserId))} className={cn(base, "bg-muted text-muted-foreground", className)}>
        <Clock className="h-3.5 w-3.5" /> Wysłano
      </button>
    );
  return (
    <button onClick={() => act(() => sendFriendRequest(targetUserId), "Zaproszenie wysłane")} className={cn(base, "bg-primary text-white", className)}>
      <UserPlus className="h-3.5 w-3.5" /> Dodaj
    </button>
  );
}
