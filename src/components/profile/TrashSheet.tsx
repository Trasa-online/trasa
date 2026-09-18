import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BrandIcon, LIST_ICON, BrandTrash } from "@/components/BrandIcon";
import { resolveStored } from "@/components/PlacePhoto";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";
import { haptics } from "@/hooks/useHaptics";
import { fetchTrash, restoreFromTrash, purgeFromTrash, daysLeft, trashKey, TRASH_DAYS, type TrashEntry } from "@/lib/trash";

// KOSZ (prosba Nat 2026-09-15): usuniety wyjazd / usunieta kolekcja czeka tu 7 dni, zanim
// zniknie na dobre. Wejscie z Ustawien. Wiersz pokazuje, ile dni zostalo - bez tego "kosz"
// byl by obietnica bez terminu, a termin jest tu cala trescia funkcji.
function Thumb({ entry }: { entry: TrashEntry }) {
  const { src, failed, onError } = useImageWithFallback(resolveStored(entry.cover), 120);
  return (
    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#fcede3]">
      {src && !failed
        ? <img src={src} alt="" onError={onError} className="h-full w-full object-cover" />
        : <BrandIcon src={entry.kind === "trip" ? "/Ikona_Trasy.svg" : LIST_ICON}
            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[#EF9D78]" />}
    </span>
  );
}

export default function TrashSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation("profiles");
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<TrashEntry | null>(null);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: trashKey, enabled: open, queryFn: fetchTrash, staleTime: 30_000,
  });

  // Po odzyskaniu / skasowaniu odswiezamy takze widoki, w ktorych tresc ma sie pojawic
  // albo zniknac - inaczej user wraca na profil i nie widzi przywroconego wyjazdu.
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: trashKey });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed"] });
    queryClient.invalidateQueries({ queryKey: ["explore-grid"] });
    queryClient.invalidateQueries({ queryKey: ["explore-rankings"] });
  };

  const restore = async (e: TrashEntry) => {
    haptics.light();
    try {
      const ok = await restoreFromTrash(e.kind, e.id);
      if (!ok) { toast.error(t("trash.restore_failed")); return; }
      toast.success(t("trash.restored"));
      refreshAll();
    } catch { toast.error(t("trash.restore_failed")); }
  };

  const purge = async (e: TrashEntry) => {
    haptics.warning();
    setConfirm(null);
    try {
      const ok = await purgeFromTrash(e.kind, e.id);
      if (!ok) { toast.error(t("trash.purge_failed")); return; }
      toast.success(t("trash.purged"));
      refreshAll();
    } catch { toast.error(t("trash.purge_failed")); }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
          <SheetTitle className="flex items-center gap-2 text-lg font-black">
            <BrandTrash className="h-5 w-5 text-primary" />{t("trash.title")}
          </SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("trash.desc", { days: TRASH_DAYS })}</p>

          {isLoading ? (
            <div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center">
              <BrandTrash className="mx-auto mb-3 h-12 w-12 text-[#ef9d78]" />
              <p className="text-base font-bold">{t("trash.empty_title")}</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("trash.empty_desc", { days: TRASH_DAYS })}</p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-border/40">
              {entries.map((e) => {
                const left = daysLeft(e.expires_at);
                return (
                  <div key={`${e.kind}:${e.id}`} className="flex items-center gap-3 py-3">
                    <Thumb entry={e} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-foreground">
                        {e.title || t(e.kind === "trip" ? "trash.trip_fallback" : "trash.list_fallback")}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {t(e.kind === "trip" ? "trash.trip_meta" : "trash.list_meta", { count: e.items })}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-primary">
                        {left === 0 ? t("trash.expires_today") : t("trash.expires_in", { count: left })}
                      </p>
                    </div>
                    <button
                      onClick={() => void restore(e)}
                      aria-label={t("trash.restore")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-90 transition-transform"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { haptics.light(); setConfirm(e); }}
                      aria-label={t("trash.purge")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-destructive active:scale-90 transition-transform"
                    >
                      <BrandTrash className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Potwierdzenie NAZYWA SKUTEK, nie pyta "na pewno?" - to jedyne miejsce w apce, gdzie
          tresc znika naprawde i bez odwrotu. */}
      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("trash.purge_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("trash.purge_desc", { name: confirm?.title || t(confirm?.kind === "trip" ? "trash.trip_fallback" : "trash.list_fallback") })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => confirm && void purge(confirm)}>
              {t("trash.purge")}
            </AlertDialogAction>
            <AlertDialogCancel>{t("trash.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
