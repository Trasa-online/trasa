import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { toast } from "sonner";
import { Clock, Loader2, Users } from "lucide-react";
import { BrandCheck } from "@/components/BrandIcon";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFriendStatus, sendFriendRequest, respondToFriendRequest, removeFriend, invalidateFriends } from "@/lib/friends";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

// GUZIK ZNAJOMOSCI: Dodaj -> Wyslano -> (u drugiej strony) Akceptuj -> Znajomi.
//
// ⚠️ Stoi OBOK guzika obserwowania i to nie jest dublowanie: obserwowanie jest publiczne
// i jednostronne, znajomosc - obustronna i to ona otwiera zdjecia "tylko dla znajomych".
// ⛔ Rozroznia je IKONA, nie sam kolor: znajomosc to DWIE osoby (`Users`), obserwowanie -
// jedna (`BrandUserPlus` / `UserCheck`). Pierwsza wersja miala w obu kolkach osobe
// z ptaszkiem i roznily sie wylacznie tlem - sprawdzone renderem w WebKit, nie dalo sie ich
// od siebie odczytac. Kolor niesie dodatkowo stan: zolty = relacja (marka), szary = czekam,
// pomaranczowy = guzik czegos ODE MNIE chce ("Przyjmij").
// ⚠️ Stan "jestescie znajomymi" ma jeszcze PLAKIETKE z ptaszkiem w rogu - bez niej wyglada
// dokladnie jak "dodaj do znajomych".
//
// ⛔ Wyslanie zaproszenia ZAKLADA TEZ OBSERWACJE (patrz `src/lib/friends.ts`), wiec po
// tapnieciu odswiezamy takze stan guzika obok - inaczej pokazywalby "Obserwuj" mimo ze
// obserwacja juz jest.

interface Props {
  targetUserId: string;
  className?: string;
  /** Sama ikona w kolku - naglowek profilu publicznego (tak samo jak `FollowButton`). */
  iconOnly?: boolean;
}

export default function FriendButton({ targetUserId, className, iconOnly = false }: Props) {
  const { t } = useTranslation("social");
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const qc = useQueryClient();
  const { data: status = "none" } = useFriendStatus(user?.id, targetUserId);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!user || status === "self" || user.id === targetUserId) return null;

  const run = async (fn: () => Promise<boolean | string>, okMsg?: string) => {
    if (busy) return;
    if (isAnonymous) { openAuthDrawer({ mode: "register", hint: "follow" }); return; }
    setBusy(true);
    try {
      const res = await fn();
      invalidateFriends(qc, user.id);
      if (res === "guest_not_allowed" || res === "unavailable") { toast.error(t("friend.unavailable")); return; }
      if (res === "error" || res === false) { toast.error(t("friend.error_generic")); return; }
      haptics.light();
      if (res === "accepted") { toast(t("friend.added")); return; }
      if (res === "already_friends") return;
      if (okMsg) toast(okMsg);
    } catch {
      toast.error(t("friend.error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const label =
    status === "friends" ? t("friend.friends")
    : status === "pending_in" ? t("friend.accept")
    : status === "pending_out" ? t("friend.sent")
    : t("friend.add_long");

  const onTap = () => {
    if (status === "friends") { setConfirmRemove(true); return; }
    if (status === "pending_in") { void run(() => respondToFriendRequest(targetUserId, true), t("friend.added")); return; }
    if (status === "pending_out") { void run(() => removeFriend(targetUserId), t("friend.request_cancelled")); return; }
    void run(() => sendFriendRequest(targetUserId), t("friend.request_sent"));
  };

  const icon = busy ? <Loader2 className="h-4 w-4 animate-spin" />
    : status === "pending_in" ? <BrandCheck className="h-4 w-4" strokeWidth={2.4} />
    : status === "pending_out" ? <Clock className="h-4 w-4" strokeWidth={2.4} />
    : (
      <span className="relative flex items-center justify-center">
        <Users className="h-[18px] w-[18px]" strokeWidth={2.2} />
        {status === "friends" ? (
          <span className="absolute -bottom-1.5 -right-2 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#5B2C06]">
            <BrandCheck className="h-2.5 w-2.5 text-[#FDF184]" />
          </span>
        ) : (
          <span className="absolute -bottom-1.5 -right-2 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#5B2C06] text-[10px] font-black leading-none text-[#FDF184]">+</span>
        )}
      </span>
    );

  const tone =
    status === "pending_in" ? "bg-primary text-white shadow-sm"
    : status === "pending_out" ? "bg-muted text-muted-foreground border border-border/50"
    : "bg-[#FDF184] text-[#5B2C06]";

  const confirm = (
    <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
      <AlertDialogContent>
        <AlertDialogTitle>{t("friend.remove_title")}</AlertDialogTitle>
        {/* Mowimy WPROST, co znika, a co zostaje - inaczej user musi zgadywac, czy
            "usun ze znajomych" odobserwuje go przy okazji (nie odobserwowuje). */}
        <AlertDialogDescription>{t("friend.remove_desc")}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            onClick={() => void run(() => removeFriend(targetUserId), t("friend.removed"))}
          >
            {t("friend.remove_confirm")}
          </AlertDialogAction>
          <AlertDialogCancel>{t("friend.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (iconOnly) {
    return (
      <>
        <button
          onClick={onTap}
          disabled={busy}
          aria-label={label}
          title={label}
          className={cn("h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-60", tone, className)}
        >
          {icon}
        </button>
        {confirm}
      </>
    );
  }

  return (
    <>
      <button
        onClick={onTap}
        disabled={busy}
        className={cn("shrink-0 h-9 px-4 rounded-full text-[13px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60", tone, className)}
      >
        {icon} {label}
      </button>
      {confirm}
    </>
  );
}
