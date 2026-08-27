import { useState } from "react";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { createPortal } from "react-dom";
import { Flag, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";

// Dyskretny link "Zgłoś" na dole wizytówki + arkusz z powodami. Zgłaszać mogą tylko
// realni (NIE-anonimowi) userzy - anon dostaje drawer rejestracji. Zapis do place_flags,
// moderacja ręczna w panelu admina. Anty-spam: 1 otwarte zgłoszenie na (miejsce, user).
const REASONS: { id: string; label: string; emoji: string }[] = [
  { id: "bad_photo", label: "Złe / nieaktualne zdjęcie", emoji: "📷" },
  { id: "wrong_category", label: "Zła kategoria", emoji: "🏷️" },
  { id: "closed", label: "Zamknięte / nie istnieje", emoji: "🚪" },
  { id: "wrong_data", label: "Błędne dane (adres, godziny)", emoji: "📍" },
  { id: "inappropriate", label: "Treść niezgodna", emoji: "⚠️" },
  { id: "other", label: "Inne", emoji: "✏️" },
];

export default function ReportPlaceLink({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz (blokada w trakcie wysylki).
  const { dragProps } = useDragToDismiss({ onDismiss: () => setOpen(false), enabled: !submitting });

  const startReport = () => {
    if (!user || isAnonymous) { openAuthDrawer({ mode: "register", hint: "report_place" }); return; }
    setOpen(true);
  };

  const submit = async () => {
    if (!reason || !user) return;
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("place_flags")
      .insert({ place_id: placeId, user_id: user.id, reason, note: note.trim() || null });
    setSubmitting(false);
    if (error) {
      // 23505 = unikalny indeks (juz ma otwarte zgloszenie tego miejsca)
      if ((error as any).code === "23505") { toast.info("Już zgłosiłeś to miejsce - dzięki!"); setOpen(false); return; }
      toast.error("Nie udało się wysłać zgłoszenia");
      return;
    }
    setDone(true);
    toast.success("Dzięki, sprawdzimy to 🙌");
    setTimeout(() => { setOpen(false); setReason(null); setNote(""); setDone(false); }, 900);
  };

  return (
    <>
      <button
        onClick={startReport}
        className="mx-auto mt-1 flex items-center gap-1.5 text-xs text-muted-foreground active:opacity-60 transition-opacity"
      >
        <Flag className="h-3.5 w-3.5" />
        <span>Coś nie tak z tym miejscem? <span className="font-semibold underline underline-offset-2">Zgłoś</span></span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={() => !submitting && setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
          <div {...dragProps} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" style={{ ...dragProps.style, maxHeight: "88dvh" }}>
            <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
            <button onClick={() => setOpen(false)} aria-label="Zamknij" className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
              <X className="h-4 w-4" />
            </button>
            <p className="text-lg font-bold pr-8">Zgłoś problem</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 line-clamp-1">{placeName}</p>
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors active:scale-[0.99] ${reason === r.id ? "border-primary bg-primary/5" : "border-border/50 bg-secondary/40"}`}
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{r.label}</span>
                  {reason === r.id && <Check className="h-4 w-4 text-primary ml-auto shrink-0" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Dodaj szczegóły (opcjonalnie)"
              rows={2}
              className="w-full mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500/40 resize-none placeholder:text-muted-foreground/60"
              style={{ fontSize: "16px" }}
            />
            <button
              onClick={submit}
              disabled={!reason || submitting || done}
              className="w-full mt-3 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {done ? <Check className="h-5 w-5" strokeWidth={3} /> : submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Wyślij zgłoszenie"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
