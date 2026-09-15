import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import { LIST_THEMES, listTheme, type ListThemeId } from "@/lib/listThemes";

// Tlo listy (prosba Nat 2026-09-13): autor wybiera kolor kafelka listy na siatce Glownej
// z palety marki (lib/listThemes). Podglad = miniatura kafelka w kazdym kolorze, tap zapisuje
// od razu (discovery_collections.theme) - jedna wartosc, bez osobnego "Zapisz".
export default function ListThemeSheet({ open, onOpenChange, listId, current, title }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listId: string;
  /** Zapisane tlo (null = domyslne, wyliczane z id). */
  current: string | null | undefined;
  title: string;
}) {
  const { t } = useTranslation("routelist");
  const queryClient = useQueryClient();
  const active = listTheme(current, listId).id;
  const explicit = LIST_THEMES.some((th) => th.id === current);

  const choose = async (id: ListThemeId) => {
    haptics.selection();
    queryClient.setQueryData(["shared-list", listId], (old: any) => (old ? { ...old, theme: id } : old));
    const { error } = await (supabase as any).from("discovery_collections").update({ theme: id }).eq("id", listId);
    if (error) { toast.error(t("theme.save_failed")); queryClient.invalidateQueries({ queryKey: ["shared-list", listId] }); return; }
    queryClient.invalidateQueries({ queryKey: ["explore-grid"] });
    toast.success(t("theme.saved"));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="text-lg font-black">{t("theme.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("theme.desc")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {LIST_THEMES.map((th) => {
            const isActive = th.id === active;
            return (
              <button
                key={th.id}
                onClick={() => void choose(th.id)}
                aria-pressed={isActive}
                aria-label={t(th.labelKey)}
                className={`relative flex aspect-[4/5] flex-col justify-end rounded-2xl p-2.5 text-left transition-transform active:scale-95 ${isActive ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                style={{ backgroundColor: th.bg, color: th.ink }}
              >
                {/* Miniatura mini-siatki miejsc - zeby bylo widac, jak kolor pracuje z kafelkami. */}
                <span className="mb-auto grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((i) => <span key={i} className="aspect-[2/3] rounded-[5px] bg-[#fcede3]/90" />)}
                </span>
                <span className="line-clamp-2 text-[12px] font-bold leading-tight">{title}</span>
                <span className="mt-0.5 text-[10px] font-medium opacity-80">{t(th.labelKey)}</span>
                {isActive && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-foreground shadow-md">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!explicit && <p className="mt-3 text-xs text-muted-foreground">{t("theme.default_hint")}</p>}
      </SheetContent>
    </Sheet>
  );
}
