import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptics } from "@/hooks/useHaptics";

// Notka o miejscu w OSOBNYM oknie (prosba Nat 2026-09-10).
//
// Wczesniej akcja z menu otwierala edytor wpisany w wiersz listy - technicznie dzialalo, ale
// pole potrafilo wyladowac poza ekranem albo pod klawiatura, wiec z perspektywy uzywajacego
// "nic sie nie stalo". Osobne okno ma jedna zalete, ktorej tamto nie mialo: zawsze pojawia sie
// tam, gdzie user patrzy, i samo podnosi klawiature.
//
// Zapis jest JAWNY (guzik), nie automatyczny. W wierszu auto-zapis mial sens, bo pole bylo
// czescia widoku; w oknie modalnym user oczekuje decyzji "zapisz albo anuluj".

export default function PlaceNoteSheet({ open, onOpenChange, placeName, note, onSave, placeholder }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nazwa miejsca w naglowku - okno ma powiedziec, CZEGO dotyczy notka. */
  placeName: string;
  note: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
}) {
  const { t } = useTranslation("route");
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Przy kazdym otwarciu startujemy od tresci Z BAZY - inaczej okno pamietaloby porzucony
  // szkic z poprzedniego miejsca.
  useEffect(() => { if (open) setDraft(note ?? ""); }, [open, note]);

  // Pole rosnie do calej tresci, do 45% ekranu - reszta zostaje na klawiature i guziki.
  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.45))}px`;
  };
  useEffect(() => { if (open) requestAnimationFrame(autoGrow); }, [open, draft]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      haptics.success();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <SheetTitle className="text-lg font-black leading-tight pr-8">
          {note?.trim() ? t("note.edit") : t("note.add")}
        </SheetTitle>
        <p className="mt-0.5 text-sm text-muted-foreground truncate">{placeName}</p>
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); autoGrow(); }}
          placeholder={placeholder ?? t("note.placeholder")}
          rows={3}
          autoFocus
          className="mt-4 w-full bg-muted/50 rounded-2xl px-3.5 py-3 text-[15px] text-foreground resize-none focus:outline-none border border-border/40 placeholder:text-muted-foreground/55 overflow-y-auto"
        />
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 h-11 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t("common:buttons.cancel")}
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common:buttons.save")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
