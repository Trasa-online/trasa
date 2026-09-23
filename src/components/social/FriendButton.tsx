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
// ⛔ NA PROFILU PUBLICZNYM STOI TYLKO TEN JEDEN GUZIK (decyzja Nat 2026-09-23, model
// z Facebooka). Przez dobe staly tam DWA kolka - "obserwuj" i "dodaj do znajomych" - i Nat
// zglosila to jako mylace: oba dotycza relacji, oba maja ludzika, a roznica miedzy nimi jest
// dla usera niewidoczna. Teraz jest jedno zdanie do podjecia: "dodaj do znajomych".
// Obserwowanie dzieje sie SAMO przy wyslaniu zaproszenia, a gdy druga strona nie przyjmie -
// zostaje samo obserwowanie. Reczne "przestan obserwowac" przenieslo sie do menu "⋮".
//
// Kolory niosa stan: pomaranczowy = akcja ode mnie ("Dodaj", "Przyjmij"), szary = czekam,
// zolty marki = jestesmy znajomymi (ten sam kolor, co plakietka "Znajomi" w listach ludzi).
//
// ⛔ Wyslanie zaproszenia ZAKLADA TEZ OBSERWACJE (patrz `src/lib/friends.ts`), wiec po
// tapnieciu odswiezamy takze stan guzika obok - inaczej pokazywalby "Obserwuj" mimo ze
// obserwacja juz jest.

interface Props {
  targetUserId: string;
  className?: string;
  /** Sama ikona w kolku - listy ludzi, gdzie na napis nie ma miejsca. */
  iconOnly?: boolean;
  /** Pelna szerokosc z napisem - profil publiczny. */
  block?: boolean;
}

export default function FriendButton({ targetUserId, className, iconOnly = false, block = false }: Props) {
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
    : status === "pending_in" ? t("friend.accept_request")
    : status === "pending_out" ? t("friend.request_pending")
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
    status === "friends" ? "bg-[#FDF184] text-[#5B2C06]"
    : status === "pending_out" ? "bg-secondary text-muted-foreground"
    : "bg-primary text-white shadow-sm";

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
        className={cn(
          // ⚠️ gap-3, nie gap-2: plakietka ("+" albo ptaszek) wystaje 8 px poza ikone i przy
          // mniejszym odstepie dotykala pierwszej litery napisu.
          "rounded-full font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-60",
          block ? "h-11 w-full text-[15px]" : "shrink-0 h-9 px-4 text-[13px]",
          tone, className,
        )}
      >
        {icon} {label}
      </button>
      {confirm}
    </>
  );
}
