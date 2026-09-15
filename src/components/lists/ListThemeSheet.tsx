import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Pipette } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import { LIST_THEMES, listTheme, isHexTheme, inkFor, HEX_RE, type ListThemeId } from "@/lib/listThemes";

// Tlo listy (prosba Nat 2026-09-13): autor wybiera kolor kafelka listy na siatce Glownej.
// Podglad = miniatura kafelka w kazdym kolorze, tap zapisuje od razu
// (discovery_collections.theme) - jedna wartosc, bez osobnego "Zapisz".
//
// 2026-09-15 (prosba Nat): paleta urosla z 9 do 18 kolorow, a pod nia stoi KOLOR WLASNY
// z pipety. Kolor tekstu nie jest wybierany ani zapisywany - liczy go `inkFor` z jasnosci
// tla, wiec zaden kolor z pipety nie da nieczytelnego kafelka.
export default function ListThemeSheet({ open, onOpenChange, listId, current, title }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listId: string;
  /** Zapisane tlo: id z palety, `#RRGGBB` albo null (domyslne, wyliczane z id). */
  current: string | null | undefined;
  title: string;
}) {
  const { t } = useTranslation("routelist");
  const queryClient = useQueryClient();
  // `draft` = kolor trzymany przez palec na pipecie: podglad na zywo, zapis dopiero po chwili.
  const [draft, setDraft] = useState<string | null>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  const persistTimer = useRef<number | null>(null);

  const saved = draft ?? current;
  const active = listTheme(saved, listId).id;
  const explicit = LIST_THEMES.some((th) => th.id === saved) || isHexTheme(saved);
  const customActive = isHexTheme(saved);
  // Wartosc startowa pipety: kolor wlasny, jesli jest; inaczej aktualne tlo z palety.
  const pickerValue = (customActive ? (saved as string) : listTheme(saved, listId).bg).toLowerCase();

  const save = async (value: string, opts?: { silent?: boolean }) => {
    queryClient.setQueryData(["shared-list", listId], (old: any) => (old ? { ...old, theme: value } : old));
    const { error } = await (supabase as any).from("discovery_collections").update({ theme: value }).eq("id", listId);
    if (error) { toast.error(t("theme.save_failed")); queryClient.invalidateQueries({ queryKey: ["shared-list", listId] }); return; }
    queryClient.invalidateQueries({ queryKey: ["explore-grid"] });
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed"] });
    if (!opts?.silent) toast.success(t("theme.saved"));
  };

  const choose = async (id: ListThemeId) => {
    haptics.selection();
    setDraft(null);
    await save(id);
  };

  // Pipeta: `input` (kazdy ruch palca) -> sam podglad + odlozony zapis; `change` (zamkniecie
  // palety systemowej) -> zapis od razu. Ten sam uklad co przy kolorze ramki awatara: iOS
  // strzela `input` przy kazdym drgnieciu, wiec bez odroczenia bylby zapis na kazda klatke.
  const persistDraft = (hex: string) => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = null;
    const value = hex.toUpperCase();
    setDraft(null);
    void save(value, { silent: true });
  };
  const onColorInput = (hex: string) => {
    if (!HEX_RE.test(hex)) return;
    setDraft(hex.toUpperCase());
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => persistDraft(hex), 600);
  };
  useEffect(() => {
    const el = colorInput.current;
    if (!el) return;
    const onChange = () => persistDraft(el.value);
    el.addEventListener("change", onChange);
    return () => { el.removeEventListener("change", onChange); if (persistTimer.current) window.clearTimeout(persistTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const Preview = ({ bg, ink, label, isActive }: { bg: string; ink: string; label: string; isActive: boolean }) => (
    <>
      {/* Miniatura mini-siatki miejsc - zeby bylo widac, jak kolor pracuje z kafelkami. */}
      <span className="mb-auto grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="aspect-[2/3] rounded-[5px] bg-[#fcede3]/90" />)}
      </span>
      <span className="line-clamp-2 text-[12px] font-bold leading-tight" style={{ color: ink }}>{title}</span>
      <span className="mt-0.5 text-[10px] font-medium opacity-80" style={{ color: ink }}>{label}</span>
      {isActive && (
        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-foreground shadow-md">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      <span className="sr-only">{bg}</span>
    </>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="text-lg font-black">{t("theme.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("theme.desc")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {LIST_THEMES.map((th) => {
            const isActive = th.id === active && !customActive;
            return (
              <button
                key={th.id}
                onClick={() => void choose(th.id)}
                aria-pressed={isActive}
                aria-label={t(th.labelKey)}
                className={`relative flex aspect-[4/5] flex-col justify-end rounded-2xl p-2.5 text-left transition-transform active:scale-95 ${isActive ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                style={{ backgroundColor: th.bg, color: th.ink }}
              >
                <Preview bg={th.bg} ink={th.ink} label={t(th.labelKey)} isActive={isActive} />
              </button>
            );
          })}

          {/* KOLOR WLASNY - kafelek z natywna pipeta rozciagnieta na cala powierzchnie.
              Zadnego guzika pod inputem: tap trafialby w oba naraz i WebKit zamykal palete
              zaraz po otwarciu (ten sam blad co przy kolorze ramki awatara, 2026-09-11). */}
          <span
            aria-pressed={customActive}
            className={`relative flex aspect-[4/5] flex-col justify-end rounded-2xl p-2.5 text-left transition-transform active:scale-95 ${customActive ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
            style={customActive
              ? { backgroundColor: saved as string, color: inkFor(saved as string) }
              : { backgroundImage: "conic-gradient(from 0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)", color: "#FFFFFF" }}
          >
            {customActive ? (
              <Preview bg={saved as string} ink={inkFor(saved as string)} label={t("theme.custom")} isActive />
            ) : (
              <>
                <span className="mb-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                  <Pipette className="h-4 w-4 text-foreground" />
                </span>
                <span className="text-[12px] font-bold leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{t("theme.custom")}</span>
                <span className="mt-0.5 text-[10px] font-medium opacity-90 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{t("theme.custom_hint")}</span>
              </>
            )}
            <input
              ref={colorInput}
              type="color"
              value={pickerValue}
              onChange={(e) => onColorInput(e.target.value)}
              aria-label={t("theme.custom")}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl opacity-0"
            />
          </span>
        </div>
        {!explicit && <p className="mt-3 text-xs text-muted-foreground">{t("theme.default_hint")}</p>}
      </SheetContent>
    </Sheet>
  );
}
