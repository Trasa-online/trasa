import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Flag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";

// Zgloszenie TRESCI od uzytkownika: wyjazd (route), lista (collection) albo profil (user).
// Wymog App Store (Guideline 1.2) obok blokowania userow i akceptacji regulaminu.
// Zdjecia/wizytowki miejsc maja osobna sciezke - place_flags + ReportPlaceLink.
// Zapis do content_reports, moderacja reczna w panelu admina. Anty-spam: jedno OTWARTE
// zgloszenie na (tresc, zglaszajacy) - pilnuje tego unikalny indeks w bazie.
export type ReportTarget = "route" | "collection" | "user";

const REASONS: { id: string; label: string }[] = [
  { id: "inappropriate", label: "Treść obraźliwa lub nieodpowiednia" },
  { id: "spam", label: "Spam albo reklama" },
  { id: "false_info", label: "Nieprawdziwe informacje" },
  { id: "privacy", label: "Cudze dane osobowe lub wizerunek" },
  { id: "copyright", label: "Naruszenie praw autorskich" },
  { id: "other", label: "Inne" },
];

const TITLE: Record<ReportTarget, string> = {
  route: "Zgłoś wyjazd",
  collection: "Zgłoś listę",
  user: "Zgłoś profil",
};

export default function ReportContentSheet({ targetType, targetId, trigger, className }: {
  targetType: ReportTarget;
  targetId: string;
  /** Gdy nie podasz - renderuje dyskretny link "Zgłoś". */
  trigger?: (open: () => void) => React.ReactNode;
  className?: string;
}) {
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const start = () => {
    if (!user || isAnonymous) { openAuthDrawer({ mode: "register", hint: "report_content" }); return; }
    setOpen(true);
  };

  const submit = async () => {
    if (!reason || !user) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("content_reports").insert({
      target_type: targetType, target_id: targetId, reporter_id: user.id,
      reason, note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      // Unikalny indeks = to zgloszenie juz czeka na rozpatrzenie.
      if (String(error.code) === "23505") { setDone(true); return; }
      toast.error("Nie udało się wysłać zgłoszenia");
      return;
    }
    setDone(true);
  };

  const close = () => { setOpen(false); setTimeout(() => { setReason(null); setNote(""); setDone(false); }, 250); };

  return (
    <>
      {trigger ? trigger(start) : (
        <button onClick={start} className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground active:opacity-60 transition-opacity ${className ?? ""}`}>
          <Flag className="h-3.5 w-3.5" /> Zgłoś
        </button>
      )}

      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <SheetTitle className="sr-only">{TITLE[targetType]}</SheetTitle>
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-[#fcede3] flex items-center justify-center">
                <Check className="h-6 w-6 text-[#ef9d78]" strokeWidth={2.5} />
              </div>
              <p className="text-base font-bold text-foreground">Dziękujemy za zgłoszenie</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[300px] mx-auto">
                {`Sprawdzimy tę treść w ciągu 24 godzin. Jeśli łamie zasady, usuniemy ją i zareagujemy wobec autora.`}
              </p>
              <button onClick={close} className="mt-5 w-full py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">
                Zamknij
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-foreground">{TITLE[targetType]}</h2>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{`Wybierz powód. Zgłoszenia rozpatrujemy w ciągu 24 godzin.`}</p>
              <div className="mt-4 space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-colors ${reason === r.id ? "border-[#F0A583] bg-orange-100/30 text-foreground" : "border-border bg-background text-foreground"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Opisz krótko problem (opcjonalnie)"
                className="mt-3 w-full bg-muted/50 rounded-2xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
              />
              <button
                onClick={submit}
                disabled={!reason || submitting}
                className="mt-4 w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Wyślij zgłoszenie
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
