import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Flag, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";

// Dyskretny link t("report") na dole wizytówki + arkusz z powodami. Zgłaszać mogą tylko
// realni (NIE-anonimowi) userzy - anon dostaje drawer rejestracji. Zapis do place_flags,
// moderacja ręczna w panelu admina. Anty-spam: 1 otwarte zgłoszenie na (miejsce, user).
// Stala zyje poza komponentem, wiec trzyma KLUCZE; tlumaczenie dokleja sie przy renderze.
const REASONS: { id: string; labelKey: string; emoji: string }[] = [
  { id: "bad_photo", labelKey: "reason.photo", emoji: "📷" },
  { id: "wrong_category", labelKey: "reason.category", emoji: "🏷️" },
  { id: "closed", labelKey: "reason.closed", emoji: "🚪" },
  { id: "wrong_data", labelKey: "reason.data", emoji: "📍" },
  { id: "inappropriate", labelKey: "reason.content", emoji: "⚠️" },
  { id: "other", labelKey: "reason.other", emoji: "✏️" },
];

export default function ReportPlaceLink({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { t } = useTranslation("wizytowka");
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
      if ((error as any).code === "23505") { toast.info(t("toast.already")); setOpen(false); return; }
      toast.error(t("toast.failed"));
      return;
    }
    setDone(true);
    toast.success(t("toast.sent"));
    setTimeout(() => { setOpen(false); setReason(null); setNote(""); setDone(false); }, 900);
  };

  return (
    <>
      <button
        onClick={startReport}
        className="mx-auto mt-1 flex items-center gap-1.5 text-xs text-muted-foreground active:opacity-60 transition-opacity"
      >
        <Flag className="h-3.5 w-3.5" />
        <span>{t("title")}<span className="font-semibold underline underline-offset-2">{t("report")}</span></span>
      </button>

      {/* KRYTYCZNE: arkusz MUSI byc <Sheet> (Radix), a nie recznym portalem do document.body.
          Wizytowka to drawer (vaul/Radix) w trybie modalnym, ktory ustawia `pointer-events: none`
          na <body> i wlacza je z powrotem TYLKO na swojej warstwie. Reczny portal ladowal poza ta
          warstwa -> caly ekran przestawal reagowac (nie dalo sie nawet zamknac; trzeba bylo ubic
          apke). Radix zarzadza zagniezdzonymi warstwami sam. (zgloszenie Nat 2026-08-29) */}
      <Sheet open={open} onOpenChange={(v) => { if (!v && !submitting) setOpen(false); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-0 bg-card px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] [&>button:last-child]:hidden overflow-y-auto"
          style={{ maxHeight: "88dvh" }}
          disableDragToDismiss={submitting}
        >
          <SheetTitle className="sr-only">{t("report_problem")}</SheetTitle>
          <div>
            <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
            <button onClick={() => setOpen(false)} aria-label="Zamknij" className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
              <X className="h-4 w-4" />
            </button>
            <p className="text-lg font-bold pr-8">{t("report_problem")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 line-clamp-1">{placeName}</p>
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors active:scale-[0.99] ${reason === r.id ? "border-primary bg-primary/5" : "border-border/50 bg-secondary/40"}`}
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{t(r.labelKey)}</span>
                  {reason === r.id && <Check className="h-4 w-4 text-primary ml-auto shrink-0" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t("details_placeholder")}
              rows={2}
              className="w-full mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500/40 resize-none placeholder:text-muted-foreground/60"
              style={{ fontSize: "16px" }}
            />
            <button
              onClick={submit}
              disabled={!reason || submitting || done}
              className="w-full mt-3 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {done ? <Check className="h-5 w-5" strokeWidth={3} /> : submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("submit")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
