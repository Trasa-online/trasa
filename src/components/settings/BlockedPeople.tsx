import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchBlockedIds, unblockUser } from "@/lib/blockedUsers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ZABLOKOWANI - NOWA POWIERZCHNIA (kierunek B, 2026-09-17). Blokowanie dzialalo od dawna
// (menu "..." na cudzym profilu), ale listy zablokowanych nie bylo NIGDZIE: zeby kogos
// odblokowac, trzeba bylo wejsc na jego profil - czyli znalezc osobe, ktora sie przed chwila
// schowalo. To jedyne miejsce, w ktorym widac cala te liste naraz.

interface BlockedProfile { id: string; username: string | null; first_name: string | null; avatar_url: string | null }

export default function BlockedPeople({ userId }: { userId: string }) {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BlockedProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["blocked-people", userId],
    enabled: !!userId,
    queryFn: async (): Promise<BlockedProfile[]> => {
      const ids = [...(await fetchBlockedIds(userId))];
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", ids);
      return ((data as BlockedProfile[]) ?? []).sort((a, b) =>
        (a.first_name || a.username || "").localeCompare(b.first_name || b.username || ""));
    },
  });

  const confirmUnblock = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const ok = await unblockUser(userId, pending.id);
    setBusy(false);
    setPending(null);
    if (!ok) { toast.error(t("blocked.unblock_error")); return; }
    toast.success(t("blocked.unblocked", { name: pending.first_name || pending.username || "" }));
    queryClient.invalidateQueries({ queryKey: ["blocked-people", userId] });
    queryClient.invalidateQueries({ queryKey: ["blocked-ids"] });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t("blocked.loading")}</div>;
  }

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FCEDE3]" aria-hidden />
        <p className="mt-5 text-base font-bold text-foreground">{t("blocked.empty_title")}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("blocked.empty_desc")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[20px] bg-muted/60">
        {people.map((p) => {
          const name = p.first_name || p.username || t("blocked.someone");
          return (
            <div key={p.id} className="flex items-center gap-3 border-b border-border/25 px-3.5 py-3 last:border-b-0">
              {/* Awatar i nazwa prowadza na profil - zablokowanie kogos nie znaczy, ze nie
                  wolno sprawdzic, kto to byl. */}
              <button
                type="button"
                onClick={() => p.username && navigate(`/profil/${p.username}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
              >
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={avatarSrc(p.avatar_url)} className="bg-orange-100 object-cover" />
                  <AvatarFallback className="bg-orange-100 text-sm font-bold text-primary">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">{name}</span>
                  {p.username && <span className="block truncate text-[13px] text-muted-foreground">@{p.username}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPending(p)}
                className="h-9 shrink-0 rounded-full bg-secondary px-4 text-[13px] font-bold text-secondary-foreground active:scale-[0.97] transition-transform"
              >
                {t("blocked.unblock")}
              </button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("blocked.confirm_title", { name: pending?.first_name || pending?.username || "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("blocked.confirm_desc")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnblock} disabled={busy}>{t("blocked.unblock")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
